// ============================================================================
// CHATVISTA - Integration Routes
// Third-party integrations (Calendar, Slack, etc.)
// ============================================================================

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { IntegrationType, IntegrationStatus } from '@prisma/client';

const router: Router = Router();

// All routes require authentication
router.use(authenticate);

// Get organization's connected integrations
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const integrations = await prisma.integration.findMany({
      where: { organizationId: user.organizationId },
      select: {
        id: true,
        type: true,
        name: true,
        status: true,
        scopes: true,
        createdAt: true,
        lastSyncAt: true,
      },
    });

    res.json({ integrations });
  } catch (error) {
    logger.error('Failed to fetch integrations', { error, userId: req.user!.id });
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
});

// Available integrations
router.get('/available', (_req: Request, res: Response) => {
  const availableIntegrations = [
    {
      id: 'google-calendar',
      type: 'CALENDAR' as IntegrationType,
      name: 'Google Calendar',
      description: 'Sync meetings with Google Calendar',
      icon: 'google',
      scopes: ['calendar.events', 'calendar.readonly'],
    },
    {
      id: 'outlook-calendar',
      type: 'CALENDAR' as IntegrationType,
      name: 'Outlook Calendar',
      description: 'Sync meetings with Microsoft Outlook',
      icon: 'microsoft',
      scopes: ['Calendars.ReadWrite'],
    },
    {
      id: 'slack',
      type: 'COMMUNICATION' as IntegrationType,
      name: 'Slack',
      description: 'Get meeting notifications in Slack',
      icon: 'slack',
      scopes: ['chat:write', 'channels:read'],
    },
    {
      id: 'notion',
      type: 'PROJECT_MANAGEMENT' as IntegrationType,
      name: 'Notion',
      description: 'Export meeting notes to Notion',
      icon: 'notion',
      scopes: ['read_content', 'insert_content'],
    },
    {
      id: 'zapier',
      type: 'CUSTOM' as IntegrationType,
      name: 'Zapier',
      description: 'Connect with 5000+ apps via Zapier',
      icon: 'zapier',
      scopes: [],
    },
    {
      id: 'google-drive',
      type: 'CLOUD_STORAGE' as IntegrationType,
      name: 'Google Drive',
      description: 'Store recordings in Google Drive',
      icon: 'google',
      scopes: ['drive.file'],
    },
    {
      id: 'dropbox',
      type: 'CLOUD_STORAGE' as IntegrationType,
      name: 'Dropbox',
      description: 'Store recordings in Dropbox',
      icon: 'dropbox',
      scopes: ['files.content.write'],
    },
  ];

  res.json({ integrations: availableIntegrations });
});

// Initiate OAuth connection
router.post('/connect/:integrationType', async (req: Request, res: Response): Promise<void> => {
  const { integrationType } = req.params;
  const { redirectUri } = req.body;

  try {
    // Generate state for CSRF protection
    const state = Buffer.from(
      JSON.stringify({
        userId: req.user!.id,
        integrationType,
        timestamp: Date.now(),
      })
    ).toString('base64');

    let authUrl: string;

    switch (integrationType) {
      case 'google-calendar':
        authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `response_type=code&` +
          `scope=${encodeURIComponent('https://www.googleapis.com/auth/calendar')}&` +
          `state=${state}&` +
          `access_type=offline&` +
          `prompt=consent`;
        break;

      case 'outlook-calendar':
        authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
          `client_id=${process.env.MICROSOFT_CLIENT_ID}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `response_type=code&` +
          `scope=${encodeURIComponent('https://graph.microsoft.com/Calendars.ReadWrite offline_access')}&` +
          `state=${state}`;
        break;

      case 'slack':
        authUrl = `https://slack.com/oauth/v2/authorize?` +
          `client_id=${process.env.SLACK_CLIENT_ID}&` +
          `scope=chat:write,channels:read&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `state=${state}`;
        break;

      default:
        res.status(400).json({ error: 'Unsupported integration type' });
        return;
    }

    res.json({ authUrl, state });
  } catch (error) {
    logger.error('Failed to initiate OAuth', { error, integrationType });
    res.status(500).json({ error: 'Failed to initiate connection' });
  }
});

// Handle OAuth callback
router.post('/callback/:integrationType', async (req: Request, res: Response): Promise<void> => {
  const { integrationType } = req.params;
  const { code: _code, state } = req.body;

  try {
    // Verify state
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    
    if (stateData.userId !== req.user!.id) {
      res.status(400).json({ error: 'Invalid state' });
      return;
    }

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Exchange code for tokens (implement for each provider)
    let tokens: { accessToken: string; refreshToken?: string; expiresAt?: Date };
    let integType: IntegrationType;
    let integName: string;

    switch (integrationType) {
      case 'google-calendar':
        tokens = { accessToken: 'mock', refreshToken: 'mock' };
        integType = 'CALENDAR';
        integName = 'Google Calendar';
        break;
      case 'outlook-calendar':
        tokens = { accessToken: 'mock', refreshToken: 'mock' };
        integType = 'CALENDAR';
        integName = 'Outlook Calendar';
        break;
      case 'slack':
        tokens = { accessToken: 'mock' };
        integType = 'COMMUNICATION';
        integName = 'Slack';
        break;
      default:
        res.status(400).json({ error: 'Unsupported integration type' });
        return;
    }

    // Check if integration already exists
    const existingIntegration = await prisma.integration.findFirst({
      where: {
        organizationId: user.organizationId,
        type: integType,
        name: integName,
      },
    });

    let integration;
    
    if (existingIntegration) {
      // Update existing
      integration = await prisma.integration.update({
        where: { id: existingIntegration.id },
        data: {
          config: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt?.toISOString(),
          },
          credentials: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
          },
          status: IntegrationStatus.ACTIVE,
        },
      });
    } else {
      // Create new
      integration = await prisma.integration.create({
        data: {
          organizationId: user.organizationId,
          type: integType,
          name: integName,
          config: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt?.toISOString(),
          },
          credentials: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
          },
          status: IntegrationStatus.ACTIVE,
          createdById: req.user!.id,
        },
      });
    }

    res.json({
      success: true,
      integration: {
        id: integration.id,
        type: integration.type,
        name: integration.name,
        status: integration.status,
      },
    });
  } catch (error) {
    logger.error('OAuth callback failed', { error, integrationType });
    res.status(500).json({ error: 'Failed to complete connection' });
  }
});

// Disconnect integration
router.delete('/:integrationId', async (req: Request, res: Response): Promise<void> => {
  const { integrationId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        organizationId: user.organizationId,
      },
    });

    if (!integration) {
      res.status(404).json({ error: 'Integration not found' });
      return;
    }

    // Revoke tokens if possible (implement for each provider)

    await prisma.integration.delete({
      where: { id: integrationId },
    });

    res.json({ success: true, message: 'Integration disconnected' });
  } catch (error) {
    logger.error('Failed to disconnect integration', { error, integrationId });
    res.status(500).json({ error: 'Failed to disconnect integration' });
  }
});

// Sync integration
router.post('/:integrationId/sync', async (req: Request, res: Response): Promise<void> => {
  const { integrationId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        organizationId: user.organizationId,
      },
    });

    if (!integration) {
      res.status(404).json({ error: 'Integration not found' });
      return;
    }

    // Trigger sync (would be implemented per provider)
    await prisma.integration.update({
      where: { id: integrationId },
      data: { lastSyncAt: new Date() },
    });

    res.json({ success: true, message: 'Sync initiated' });
  } catch (error) {
    logger.error('Failed to sync integration', { error, integrationId });
    res.status(500).json({ error: 'Failed to sync' });
  }
});

export default router;
