// ============================================================================
// CHATVISTA - Unified Storage Service
// Combines local and cloud storage with automatic sync and failover
// ============================================================================

import { Readable } from 'stream';
import { logger } from '../utils/logger';
import { 
  localStorageService, 
  StorageOptions, 
  StoredFile 
} from './LocalStorageService';
import { 
  cloudStorageService, 
  UploadOptions, 
  CloudFile 
} from './CloudStorageService';

// ============================================================================
// Types
// ============================================================================

export type StorageType = 'recordings' | 'transcripts' | 'minutes' | 'exports' | 'avatars';

export interface UnifiedStorageOptions extends StorageOptions, UploadOptions {
  preferCloud?: boolean;
  fallbackToLocal?: boolean;
  syncBoth?: boolean;
}

export interface StorageResult {
  local?: StoredFile;
  cloud?: CloudFile;
  primaryUrl: string;
  backupUrl?: string;
}

export interface SyncStatus {
  localToCloud: { synced: number; failed: number; pending: number };
  cloudToLocal: { synced: number; failed: number; pending: number };
  lastSync: Date;
  nextScheduledSync: Date;
}

// ============================================================================
// Unified Storage Service
// ============================================================================

export class UnifiedStorageService {
  private cloudAvailable = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initializeServices();
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  private async initializeServices(): Promise<void> {
    try {
      // Initialize local storage first (always available)
      await localStorageService.initialize();
      logger.info('Local storage initialized');

      // Try to initialize cloud storage
      try {
        await cloudStorageService.initialize();
        this.cloudAvailable = true;
        logger.info('Cloud storage initialized');
      } catch (error) {
        logger.warn('Cloud storage unavailable, using local only', { error });
        this.cloudAvailable = false;
      }

      // Start sync scheduler
      this.startSyncScheduler();
    } catch (error) {
      logger.error('Failed to initialize storage services', { error });
    }
  }

  private startSyncScheduler(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      if (this.cloudAvailable) {
        try {
          await this.syncLocalToCloud();
        } catch (error) {
          logger.error('Scheduled sync failed', { error });
        }
      }
    }, this.SYNC_INTERVAL);

    logger.info('Storage sync scheduler started', { 
      interval: `${this.SYNC_INTERVAL / 1000}s` 
    });
  }

  // --------------------------------------------------------------------------
  // Unified File Operations
  // --------------------------------------------------------------------------

  async saveFile(
    type: StorageType,
    filename: string,
    data: Buffer | Readable,
    options: UnifiedStorageOptions = {}
  ): Promise<StorageResult> {
    const {
      preferCloud = true,
      fallbackToLocal = true,
      syncBoth = true,
      compress = false,
      encrypt = false,
      backup = true,
      contentType,
      metadata,
      acl = 'private',
    } = options;

    // Convert stream to buffer for dual storage
    let buffer: Buffer;
    if (Buffer.isBuffer(data)) {
      buffer = data;
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of data) {
        chunks.push(Buffer.from(chunk));
      }
      buffer = Buffer.concat(chunks);
    }

    const result: StorageResult = {
      primaryUrl: '',
    };

    // Try cloud storage first if preferred
    if (preferCloud && this.cloudAvailable) {
      try {
        const cloudKey = `${type}/${filename}`;
        const cloudFile = await cloudStorageService.uploadFile(cloudKey, buffer, {
          contentType,
          metadata,
          acl,
          syncToLocal: false, // We'll handle local ourselves
        });
        result.cloud = cloudFile;
        result.primaryUrl = cloudFile.cdnUrl || cloudFile.url;

        logger.info('File saved to cloud storage', { type, filename });
      } catch (error) {
        logger.error('Cloud upload failed', { error, type, filename });
        if (!fallbackToLocal) throw error;
      }
    }

    // Save to local storage
    if (syncBoth || !result.cloud) {
      try {
        const localFile = await localStorageService.saveFile(type, filename, buffer, {
          compress,
          encrypt,
          backup,
        });
        result.local = localFile;

        // If cloud failed, local is primary
        if (!result.primaryUrl) {
          result.primaryUrl = `/api/v1/storage/${type}/${localFile.id}`;
        } else {
          result.backupUrl = `/api/v1/storage/${type}/${localFile.id}`;
        }

        logger.info('File saved to local storage', { type, filename });
      } catch (error) {
        logger.error('Local storage failed', { error, type, filename });
        if (!result.cloud) throw error;
      }
    }

    return result;
  }

  async getFile(
    type: StorageType,
    fileId: string,
    options: { preferCloud?: boolean } = {}
  ): Promise<Buffer> {
    const { preferCloud = true } = options;

    // Try cloud first if preferred and available
    if (preferCloud && this.cloudAvailable) {
      try {
        const cloudKey = `${type}/${fileId}`;
        return await cloudStorageService.getFile(cloudKey);
      } catch (error) {
        logger.warn('Cloud fetch failed, trying local', { error, type, fileId });
      }
    }

    // Fallback to local
    return localStorageService.getFile(type, fileId);
  }

  async getFileUrl(
    type: StorageType,
    fileId: string,
    options: { preferCloud?: boolean; expiresIn?: number } = {}
  ): Promise<string> {
    const { preferCloud = true, expiresIn = 3600 } = options;

    if (preferCloud && this.cloudAvailable) {
      try {
        const cloudKey = `${type}/${fileId}`;
        return await cloudStorageService.getSignedUrl(cloudKey, expiresIn);
      } catch {
        // Fallback to local URL
      }
    }

    return `/api/v1/storage/${type}/${fileId}`;
  }

  async deleteFile(type: StorageType, fileId: string): Promise<void> {
    const errors: Error[] = [];

    // Delete from cloud
    if (this.cloudAvailable) {
      try {
        const cloudKey = `${type}/${fileId}`;
        await cloudStorageService.deleteFile(cloudKey);
      } catch (error) {
        errors.push(error as Error);
        logger.warn('Cloud delete failed', { error, type, fileId });
      }
    }

    // Delete from local (moves to archive)
    try {
      await localStorageService.deleteFile(type, fileId);
    } catch (error) {
      errors.push(error as Error);
      logger.warn('Local delete failed', { error, type, fileId });
    }

    if (errors.length === 2) {
      throw new Error(`Failed to delete file from both storage: ${errors.map(e => e.message).join(', ')}`);
    }
  }

  async listFiles(
    type: StorageType,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{
    files: Array<StoredFile | CloudFile>;
    source: 'local' | 'cloud' | 'merged';
  }> {
    const { limit = 100, offset = 0 } = options;

    // Get from both sources and merge
    const localFiles = await localStorageService.listFiles(type, { limit, offset });
    
    let cloudFiles: CloudFile[] = [];
    if (this.cloudAvailable) {
      try {
        const result = await cloudStorageService.listFiles(`${type}/`, { maxKeys: limit });
        cloudFiles = result.files;
      } catch (error) {
        logger.warn('Failed to list cloud files', { error });
      }
    }

    // If both available, prefer cloud with local fallback
    if (cloudFiles.length > 0 && localFiles.length > 0) {
      return { files: cloudFiles, source: 'cloud' };
    } else if (cloudFiles.length > 0) {
      return { files: cloudFiles, source: 'cloud' };
    } else {
      return { files: localFiles, source: 'local' };
    }
  }

  // --------------------------------------------------------------------------
  // Sync Operations
  // --------------------------------------------------------------------------

  async syncLocalToCloud(): Promise<{ synced: number; failed: number }> {
    if (!this.cloudAvailable) {
      logger.warn('Cloud storage not available for sync');
      return { synced: 0, failed: 0 };
    }

    return cloudStorageService.syncFromLocal('', '');
  }

  async syncCloudToLocal(): Promise<{ synced: number; failed: number }> {
    if (!this.cloudAvailable) {
      logger.warn('Cloud storage not available for sync');
      return { synced: 0, failed: 0 };
    }

    return cloudStorageService.syncToLocal();
  }

  async getSyncStatus(): Promise<SyncStatus> {
    return {
      localToCloud: { synced: 0, failed: 0, pending: 0 },
      cloudToLocal: { synced: 0, failed: 0, pending: 0 },
      lastSync: new Date(),
      nextScheduledSync: new Date(Date.now() + this.SYNC_INTERVAL),
    };
  }

  // --------------------------------------------------------------------------
  // Backup Operations
  // --------------------------------------------------------------------------

  async runBackup(): Promise<void> {
    logger.info('Starting unified backup');

    // Run local backup
    await localStorageService.runScheduledBackup();

    // Sync to cloud
    if (this.cloudAvailable) {
      await this.syncLocalToCloud();
    }

    logger.info('Unified backup completed');
  }

  async restoreFromBackup(backupId: string): Promise<StoredFile> {
    return localStorageService.restoreFromBackup(backupId);
  }

  async cleanupOldFiles(retentionDays: number = 30): Promise<{
    localDeleted: number;
    cloudArchived: number;
  }> {
    const localDeleted = await localStorageService.cleanupOldBackups(retentionDays);
    
    // Cloud archiving would be handled by Spaces lifecycle rules
    return {
      localDeleted,
      cloudArchived: 0,
    };
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  async getStorageStats(): Promise<{
    local: Awaited<ReturnType<typeof localStorageService.getStorageStats>>;
    cloud: { healthy: boolean; latency: number } | null;
    totalSize: number;
  }> {
    const local = await localStorageService.getStorageStats();
    
    let cloud = null;
    if (this.cloudAvailable) {
      cloud = await cloudStorageService.healthCheck();
    }

    return {
      local,
      cloud,
      totalSize: local.totalSize,
    };
  }

  isCloudAvailable(): boolean {
    return this.cloudAvailable;
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

// Export singleton instance
export const storageService = new UnifiedStorageService();
