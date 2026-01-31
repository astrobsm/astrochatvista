// ============================================================================
// CHATVISTA - Webhook Routes
// Webhooks for external integrations
// ============================================================================

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const router: Router = Router();

// Verify webhook signature
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expectedSignature}`)
  );
}

// Stripe webhook for subscription events
router.post('/stripe', async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['stripe-signature'] as string;
  
  if (!signature) {
    res.status(400).json({ error: 'Missing signature' });
    return;
  }

  try {
    // In production, use Stripe's constructEvent
    const event = req.body;

    switch (event.type) {
      case 'checkout.session.completed':
        // Handle successful checkout
        const session = event.data.object;
        logger.info('Checkout completed', { sessionId: session.id });
        break;

      case 'customer.subscription.updated':
        // Handle subscription update
        const subscription = event.data.object;
        logger.info('Subscription updated', { subscriptionId: subscription.id });
        break;

      case 'customer.subscription.deleted':
        // Handle subscription cancellation
        const canceledSub = event.data.object;
        logger.info('Subscription canceled', { subscriptionId: canceledSub.id });
        break;

      case 'invoice.payment_failed':
        // Handle failed payment
        const invoice = event.data.object;
        logger.warn('Payment failed', { invoiceId: invoice.id });
        break;

      default:
        logger.debug('Unhandled webhook event', { type: event.type });
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook error', { error });
    res.status(400).json({ error: 'Webhook error' });
  }
});

// Calendar integration webhook (Google Calendar, Outlook)
router.post('/calendar/:provider', async (req: Request, res: Response): Promise<void> => {
  const { provider } = req.params;
  
  try {
    const event = req.body;

    switch (provider) {
      case 'google':
        // Handle Google Calendar webhook
        if (event.resourceState === 'exists') {
          // Event created or updated
          logger.info('Google Calendar event sync', { 
            eventId: event.resourceId 
          });
        }
        break;

      case 'outlook':
        // Handle Outlook webhook
        if (event.value) {
          for (const change of event.value) {
            logger.info('Outlook Calendar event sync', { 
              eventId: change.resourceData?.id 
            });
          }
        }
        break;

      default:
        res.status(400).json({ error: 'Unknown provider' });
        return;
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Calendar webhook error', { error, provider });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Recording transcription webhook (from external AI service)
router.post('/transcription', async (req: Request, res: Response): Promise<void> => {
  const { meetingId, status, transcript, segments: _segments } = req.body;

  try {
    // Find or create transcript for this meeting
    const existingTranscript = await prisma.transcript.findFirst({
      where: { meetingId },
    });

    if (status === 'completed' && transcript) {
      if (existingTranscript) {
        // Update transcript status
        await prisma.transcript.update({
          where: { id: existingTranscript.id },
          data: {
            status: 'COMPLETED',
            wordCount: transcript.split(/\\s+/).length,
            finalizedAt: new Date(),
          },
        });
      } else {
        // Create new transcript
        await prisma.transcript.create({
          data: {
            meetingId,
            status: 'COMPLETED',
            wordCount: transcript.split(/\\s+/).length,
            language: req.body.language || 'en-US',
            finalizedAt: new Date(),
          },
        });
      }

      logger.info('Transcription completed', { meetingId });
    } else if (status === 'failed') {
      if (existingTranscript) {
        await prisma.transcript.update({
          where: { id: existingTranscript.id },
          data: { status: 'FAILED' },
        });
      }

      logger.error('Transcription failed', { meetingId, error: req.body.error });
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Transcription webhook error', { error, meetingId });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Generic webhook endpoint for custom integrations
router.post('/custom/:integrationId', async (req: Request, res: Response): Promise<void> => {
  const { integrationId } = req.params;
  const signature = req.headers['x-webhook-signature'] as string;

  try {
    // Find integration settings
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      res.status(404).json({ error: 'Integration not found' });
      return;
    }

    // Verify signature if credentials contain a secret
    const credentials = integration.credentials as { webhookSecret?: string } | null;
    if (credentials?.webhookSecret) {
      const isValid = verifyWebhookSignature(
        JSON.stringify(req.body),
        signature,
        credentials.webhookSecret
      );

      if (!isValid) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    }

    // Log webhook event - store in integration config as there's no webhookEvent table
    logger.info('Custom webhook received', {
      integrationId,
      type: req.body.type || 'unknown',
      payload: req.body,
    });

    // Process based on integration type
    // This would be extended based on specific integrations

    res.json({ received: true });
  } catch (error) {
    logger.error('Custom webhook error', { error, integrationId });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
