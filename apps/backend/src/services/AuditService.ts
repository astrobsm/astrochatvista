// ============================================================================
// CHATVISTA - Audit Service
// Comprehensive audit logging for compliance and security tracking
// ============================================================================

import { prisma } from '../lib/prisma';
import { Prisma, UserRole, AuditAction, AuditResourceType, AuditResult } from '@prisma/client';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Redis } from 'ioredis';

// ============================================================================
// Types - Re-export Prisma types for external use
// ============================================================================

export type { AuditAction, AuditResourceType, AuditResult };

export interface AuditLogEntry {
  actorId: string;
  actorRole: UserRole;
  actorIp?: string;
  actorDevice?: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  resourceName?: string;
  result: AuditResult;
  organizationId?: string;
  metadata?: Record<string, unknown>;
  details?: Record<string, unknown>;  // Alias for metadata
}

export interface AuditQueryOptions {
  organizationId?: string;
  actorId?: string;
  resourceType?: AuditResourceType;
  action?: AuditAction;
  result?: AuditResult;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

// ============================================================================
// Audit Service Implementation
// ============================================================================

export class AuditService {
  private redis: Redis | null = null;
  private batchQueue: AuditLogEntry[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 100;
  private readonly BATCH_INTERVAL = 5000; // 5 seconds
  private redisAvailable = false;
  private redisErrorLogged = false;

  constructor() {
    if (config.enableAuditLogging) {
      this.initializeRedis();
    }
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  private initializeRedis(): void {
    try {
      this.redis = new Redis(config.redisUrl, {
        keyPrefix: 'audit:',
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          // In development, stop retrying after a few attempts
          if (config.env === 'development' && times > 2) {
            if (!this.redisErrorLogged) {
              logger.warn('Audit Redis unavailable in development - using database only');
              this.redisErrorLogged = true;
            }
            return null; // Stop retrying
          }
          return Math.min(times * 100, 3000);
        },
        lazyConnect: true,
        enableOfflineQueue: false,
      });

      this.redis.on('error', (_error) => {
        if (!this.redisErrorLogged) {
          logger.warn('Audit Redis unavailable - using database only for audit logs');
          this.redisErrorLogged = true;
        }
        this.redisAvailable = false;
      });

      this.redis.on('connect', () => {
        logger.info('Audit service connected to Redis');
        this.redisAvailable = true;
        this.redisErrorLogged = false;
      });

      // Try to connect but don't block
      this.redis.connect().catch(() => {
        this.redisAvailable = false;
      });
    } catch (error) {
      if (!this.redisErrorLogged) {
        logger.warn('Audit Redis initialization failed - using database only');
        this.redisErrorLogged = true;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Core Logging
  // --------------------------------------------------------------------------

  async log(entry: AuditLogEntry): Promise<void> {
    if (!config.enableAuditLogging) {
      return;
    }

    try {
      const auditRecord = {
        ...entry,
        id: this.generateId(),
        timestamp: new Date(),
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      };

      // Add to batch queue for performance
      this.batchQueue.push(entry);

      // Process immediately if batch is full
      if (this.batchQueue.length >= this.BATCH_SIZE) {
        await this.flushBatch();
      } else if (!this.batchTimeout) {
        // Set timeout to flush after interval
        this.batchTimeout = setTimeout(() => this.flushBatch(), this.BATCH_INTERVAL);
      }

      // Also write to database immediately for critical actions
      if (this.isCriticalAction(entry.action)) {
        await this.writeToDB(auditRecord);
      }

      // Cache recent audit logs in Redis
      if (this.redis) {
        await this.cacheAuditLog(auditRecord);
      }

      logger.debug('Audit log recorded', {
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
      });
    } catch (error) {
      logger.error('Failed to record audit log:', error);
      // Don't throw - audit logging should not break main flow
    }
  }

  // --------------------------------------------------------------------------
  // Batch Processing
  // --------------------------------------------------------------------------

  private async flushBatch(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.batchQueue.length === 0) {
      return;
    }

    const batch = [...this.batchQueue];
    this.batchQueue = [];

    try {
      const records = batch.map((entry) => ({
        id: this.generateId(),
        actorId: entry.actorId,
        actorRole: entry.actorRole,
        actorIp: entry.actorIp || null,
        actorDevice: entry.actorDevice || null,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        resourceName: entry.resourceName || null,
        result: entry.result,
        organizationId: entry.organizationId || '',
        details: (entry.details || entry.metadata || {}) as Prisma.InputJsonValue,
        timestamp: new Date(),
      }));

      await prisma.auditLog.createMany({
        data: records,
        skipDuplicates: true,
      });

      logger.debug(`Flushed ${records.length} audit logs to database`);
    } catch (error) {
      logger.error('Failed to flush audit batch:', error);
      // Re-queue failed entries
      this.batchQueue.unshift(...batch);
    }
  }

  // --------------------------------------------------------------------------
  // Database Operations
  // --------------------------------------------------------------------------

  private async writeToDB(record: any): Promise<void> {
    await prisma.auditLog.create({
      data: {
        id: record.id,
        actorId: record.actorId,
        actorRole: record.actorRole,
        actorIp: record.actorIp || null,
        actorDevice: record.actorDevice || null,
        action: record.action,
        resourceType: record.resourceType,
        resourceId: record.resourceId,
        resourceName: record.resourceName || null,
        result: record.result,
        organizationId: record.organizationId || '',
        details: record.metadata || {},
        timestamp: record.timestamp,
      },
    });
  }

  async query(options: AuditQueryOptions): Promise<{
    logs: any[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 50, ...filters } = options;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.organizationId) {
      where.organizationId = filters.organizationId;
    }
    if (filters.actorId) {
      where.actorId = filters.actorId;
    }
    if (filters.resourceType) {
      where.resourceType = filters.resourceType;
    }
    if (filters.action) {
      where.action = filters.action;
    }
    if (filters.result) {
      where.result = filters.result;
    }
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) {
        where.timestamp.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.timestamp.lte = filters.endDate;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // --------------------------------------------------------------------------
  // Redis Caching
  // --------------------------------------------------------------------------

  private async cacheAuditLog(record: any): Promise<void> {
    if (!this.redis || !this.redisAvailable) return;

    try {
      const key = `recent:${record.organizationId || 'global'}`;
      await this.redis.lpush(key, JSON.stringify(record));
      await this.redis.ltrim(key, 0, 999); // Keep last 1000 entries
      await this.redis.expire(key, 86400); // 24 hours
    } catch (error) {
      logger.error('Failed to cache audit log:', error);
    }
  }

  async getRecentLogs(
    organizationId?: string,
    limit: number = 100
  ): Promise<any[]> {
    if (!this.redis || !this.redisAvailable) {
      return this.query({
        organizationId,
        limit,
      }).then((r) => r.logs);
    }

    try {
      const key = `recent:${organizationId || 'global'}`;
      const cached = await this.redis.lrange(key, 0, limit - 1);
      return cached.map((item) => JSON.parse(item));
    } catch (error) {
      logger.error('Failed to get recent logs from cache:', error);
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // Compliance Reports
  // --------------------------------------------------------------------------

  async generateComplianceReport(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    summary: Record<string, number>;
    actionBreakdown: Record<string, number>;
    resourceBreakdown: Record<string, number>;
    userActivity: Array<{ userId: string; actionCount: number }>;
    failedActions: any[];
  }> {
    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const summary = {
      totalActions: logs.length,
      successfulActions: logs.filter((l: { result: string }) => l.result === 'SUCCESS').length,
      failedActions: logs.filter((l: { result: string }) => l.result === 'FAILURE').length,
      uniqueUsers: new Set(logs.map((l: { actorId: string }) => l.actorId)).size,
    };

    const actionBreakdown: Record<string, number> = {};
    const resourceBreakdown: Record<string, number> = {};
    const userActivityMap = new Map<string, number>();

    logs.forEach((log: { action: string; resourceType: string; actorId: string; result: string }) => {
      actionBreakdown[log.action] = (actionBreakdown[log.action] || 0) + 1;
      resourceBreakdown[log.resourceType] =
        (resourceBreakdown[log.resourceType] || 0) + 1;
      userActivityMap.set(
        log.actorId,
        (userActivityMap.get(log.actorId) || 0) + 1
      );
    });

    const userActivity = Array.from(userActivityMap.entries())
      .map(([userId, actionCount]) => ({ userId, actionCount }))
      .sort((a, b) => b.actionCount - a.actionCount)
      .slice(0, 50);

    const failedActions = logs
      .filter((l: { result: string }) => l.result === 'FAILURE')
      .slice(0, 100);

    return {
      summary,
      actionBreakdown,
      resourceBreakdown,
      userActivity,
      failedActions,
    };
  }

  // --------------------------------------------------------------------------
  // Data Retention
  // --------------------------------------------------------------------------

  async purgeOldLogs(retentionDays: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.auditLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    logger.info(`Purged ${result.count} audit logs older than ${retentionDays} days`);
    return result.count;
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private isCriticalAction(action: AuditAction): boolean {
    const criticalActions: AuditAction[] = [
      'DELETE',
      'LOGIN',
      'LOGOUT',
      'EXPORT',
      'APPROVE',
      'REJECT',
      'REMOVE',
    ];
    return criticalActions.includes(action);
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  async shutdown(): Promise<void> {
    await this.flushBatch();
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const auditService = new AuditService();
