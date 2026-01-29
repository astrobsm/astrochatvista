// ============================================================================
// CHATVISTA - Admin Routes
// API endpoints for system administration
// ============================================================================

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

const router: Router = Router();

// ============================================================================
// ORGANIZATION MANAGEMENT
// ============================================================================

// Get organization details
router.get('/organization', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      include: {
        _count: {
          select: { users: true, departments: true, meetings: true },
        },
      },
    });

    res.json(organization);
  } catch (error) {
    return next(error);
  }
});

// Update organization
router.patch('/organization', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const { name, domain, logo, branding, settings } = req.body;

    const organization = await prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        ...(name && { name }),
        ...(domain && { domain }),
        ...(logo && { logo }),
        ...(branding && { branding }),
        ...(settings && { settings }),
      },
    });

    res.json(organization);
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// DEPARTMENT MANAGEMENT
// ============================================================================

// List departments
router.get('/departments', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    const departments = await prisma.department.findMany({
      where: { organizationId: user!.organizationId! },
      include: {
        _count: { select: { members: true } },
        manager: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(departments);
  } catch (error) {
    return next(error);
  }
});

// Create department
router.post('/departments', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    const { name, description, managerId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const department = await prisma.department.create({
      data: {
        name,
        description,
        organizationId: user!.organizationId!,
        managerId,
      },
    });

    res.status(201).json(department);
  } catch (error) {
    return next(error);
  }
});

// Update department
router.patch('/departments/:id', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    const { name, description, managerId } = req.body;

    const department = await prisma.department.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(managerId !== undefined && { managerId }),
      },
    });

    res.json(department);
  } catch (error) {
    return next(error);
  }
});

// Delete department
router.delete('/departments/:id', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    // First, unassign users from the department
    await prisma.user.updateMany({
      where: { departmentId: req.params.id },
      data: { departmentId: null },
    });

    await prisma.department.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Department deleted' });
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// INTEGRATIONS
// ============================================================================

// List integrations
router.get('/integrations', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    const integrations = await prisma.integration.findMany({
      where: { organizationId: user!.organizationId! },
      select: {
        id: true,
        type: true,
        name: true,
        status: true,
        createdAt: true,
        lastSyncAt: true,
        // Don't include credentials
      },
    });

    res.json(integrations);
  } catch (error) {
    return next(error);
  }
});

// Create integration
router.post('/integrations', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    const { type, name, credentials, settings } = req.body;

    const integration = await prisma.integration.create({
      data: {
        type,
        name,
        organizationId: user!.organizationId!,
        credentials, // Should be encrypted in production
        settings,
        status: 'PENDING',
        createdById: req.user!.id,
      },
    });

    res.status(201).json({
      id: integration.id,
      type: integration.type,
      name: integration.name,
      status: integration.status,
    });
  } catch (error) {
    return next(error);
  }
});

// Delete integration
router.delete('/integrations/:id', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    await prisma.integration.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Integration deleted' });
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// WEBHOOKS
// ============================================================================

// List webhooks
router.get('/webhooks', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    const webhooks = await prisma.webhook.findMany({
      where: { organizationId: user!.organizationId! },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        isActive: true,
        createdAt: true,
        lastTriggeredAt: true,
        successCount: true,
        failureCount: true,
      },
    });

    res.json(webhooks);
  } catch (error) {
    return next(error);
  }
});

// Create webhook
router.post('/webhooks', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    const { name, url, events, secret, headers } = req.body;

    if (!url || !events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'URL and events are required' });
    }

    const webhook = await prisma.webhook.create({
      data: {
        name: name || 'Webhook',
        url,
        events,
        secret, // Should be hashed
        headers: headers || {},
        organizationId: user!.organizationId!,
        createdById: req.user!.id,
        isActive: true,
      },
    });

    res.status(201).json(webhook);
  } catch (error) {
    return next(error);
  }
});

// Update webhook
router.patch('/webhooks/:id', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    const { name, url, events, isActive, headers } = req.body;

    const webhook = await prisma.webhook.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(url && { url }),
        ...(events && { events }),
        ...(isActive !== undefined && { isActive }),
        ...(headers && { headers }),
      },
    });

    res.json(webhook);
  } catch (error) {
    return next(error);
  }
});

// Delete webhook
router.delete('/webhooks/:id', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    await prisma.webhook.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Webhook deleted' });
  } catch (error) {
    return next(error);
  }
});

// Test webhook
router.post('/webhooks/:id/test', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res) => {
  try {
    const webhook = await prisma.webhook.findUnique({
      where: { id: req.params.id },
    });

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Send test payload
    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from ChatVista',
      },
    };

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(webhook.headers as Record<string, string>),
      },
      body: JSON.stringify(testPayload),
    });

    return res.json({
      success: response.ok,
      statusCode: response.status,
      statusText: response.statusText,
    });
  } catch (error) {
    return res.json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================================================
// AUDIT LOGS
// ============================================================================

// Get audit logs
router.get('/audit-logs', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    const { action, userId, resourceType, from, to, limit, offset } = req.query;

    const where: any = { organizationId: user!.organizationId! };
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (resourceType) where.resourceType = resourceType;
    if (from) where.timestamp = { gte: new Date(from as string) };
    if (to) where.timestamp = { ...where.timestamp, lte: new Date(to as string) };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: limit ? parseInt(limit as string) : 100,
        skip: offset ? parseInt(offset as string) : 0,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total });
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// SYSTEM SETTINGS
// ============================================================================

// Get system settings
router.get('/settings', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { organization: true },
    });

    res.json(user?.organization?.settings || {});
  } catch (error) {
    return next(error);
  }
});

// Update system settings
router.patch('/settings', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    const organization = await prisma.organization.update({
      where: { id: user!.organizationId! },
      data: { settings: req.body },
    });

    res.json(organization.settings);
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// SYSTEM HEALTH
// ============================================================================

// Get system health
router.get('/health', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (_req, res, next) => {
  try {
    const checks: Record<string, any> = {};

    // Database check
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'healthy' };
    } catch (e) {
      checks.database = { status: 'unhealthy', error: (e as Error).message };
    }

    // Redis check
    try {
      await redis.ping();
      checks.redis = { status: 'healthy' };
    } catch (e) {
      checks.redis = { status: 'unhealthy', error: (e as Error).message };
    }

    const allHealthy = Object.values(checks).every(
      (c: any) => c.status === 'healthy'
    );

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
