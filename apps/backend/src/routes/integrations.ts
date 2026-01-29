// ============================================================================
// CHATVISTA - Integration Routes
// Third-party integrations (Calendar, Slack, etc.)
// ============================================================================

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const router: Router = Router();

// All routes require authentication
router.use(authenticate);

// Get user's connected integrations
router.get('/', async (req: Request, res: Response) => {
  try {
    const integrations = await prisma.integration.findMany({
      where: { userId: req.user!.id },
      select: {
        id: true,
        provider: true,
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
      name: 'Google Calendar',
      description: 'Sync meetings with Google Calendar',
      icon: 'google',
      scopes: ['calendar.events', 'calendar.readonly'],
    },
    {
      id: 'outlook-calendar',
      name: 'Outlook Calendar',
      description: 'Sync meetings with Microsoft Outlook',
      icon: 'microsoft',
      scopes: ['Calendars.ReadWrite'],
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Get meeting notifications in Slack',
      icon: 'slack',
      scopes: ['chat:write', 'channels:read'],
    },
    {
      id: 'notion',
      name: 'Notion',
      description: 'Export meeting notes to Notion',
      icon: 'notion',
      scopes: ['read_content', 'insert_content'],
    },
    {
      id: 'zapier',
      name: 'Zapier',
      description: 'Connect with 5000+ apps via Zapier',
      icon: 'zapier',
      scopes: [],
    },
  ];

  res.json({ integrations: availableIntegrations });
});

// Initiate OAuth connection
router.post('/connect/:provider', async (req: Request, res: Response): Promise<void> => {
  const { provider } = req.params;
  const { redirectUri } = req.body;

  try {
    // Generate state for CSRF protection
    const state = Buffer.from(
      JSON.stringify({
        userId: req.user!.id,
        provider,
        timestamp: Date.now(),
      })
    ).toString('base64');

    // Store state in Redis for verification
    // await redis.setex(`oauth:state:${state}`, 600, 'valid');

    let authUrl: string;

    switch (provider) {
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
        res.status(400).json({ error: 'Unsupported provider' });
        return;
    }

    res.json({ authUrl, state });
  } catch (error) {
    logger.error('Failed to initiate OAuth', { error, provider });
    res.status(500).json({ error: 'Failed to initiate connection' });
  }
});

// Handle OAuth callback
router.post('/callback/:provider', async (req: Request, res: Response): Promise<void> => {
  const { provider } = req.params;
  const { code: _code, state } = req.body;

  try {
    // Verify state
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    
    if (stateData.userId !== req.user!.id) {
      res.status(400).json({ error: 'Invalid state' });
      return;
    }

    // Exchange code for tokens (implement for each provider)
    let tokens: { accessToken: string; refreshToken?: string; expiresAt?: Date };

    switch (provider) {
      case 'google-calendar':
        // Exchange with Google
        tokens = { accessToken: 'mock', refreshToken: 'mock' };
        break;
      case 'outlook-calendar':
        // Exchange with Microsoft
        tokens = { accessToken: 'mock', refreshToken: 'mock' };
        break;
      case 'slack':
        // Exchange with Slack
        tokens = { accessToken: 'mock' };
        break;
      default:
        res.status(400).json({ error: 'Unsupported provider' });
        return;
    }

    // Store integration
    const integration = await prisma.integration.upsert({
      where: {
        userId_provider: {
          userId: req.user!.id,
          provider,
        },
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
        status: 'connected',
      },
      create: {
        userId: req.user!.id,
        provider,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
        status: 'connected',
      },
    });

    res.json({
      success: true,
      integration: {
        id: integration.id,
        provider: integration.provider,
        status: integration.status,
      },
    });
  } catch (error) {
    logger.error('OAuth callback failed', { error, provider });
    res.status(500).json({ error: 'Failed to complete connection' });
  }
});

// Disconnect integration
router.delete('/:integrationId', async (req: Request, res: Response): Promise<void> => {
  const { integrationId } = req.params;

  try {
    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        userId: req.user!.id,
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

// Sync calendar
router.post('/:integrationId/sync', async (req: Request, res: Response): Promise<void> => {
  const { integrationId } = req.params;

  try {
    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        userId: req.user!.id,
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
