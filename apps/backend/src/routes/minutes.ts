// ============================================================================
// CHATVISTA - Meeting Minutes Routes
// API endpoints for AI-generated meeting minutes
// ============================================================================

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { MinutesService } from '../services/MinutesService';
import { prisma } from '../lib/prisma';

const router: Router = Router();
const minutesService = new MinutesService();

// ============================================================================
// MINUTES GENERATION & RETRIEVAL
// ============================================================================

// Generate minutes for a meeting
router.post('/meeting/:meetingId/generate', authenticate, async (req, res, next) => {
  try {
    const { options } = req.body;

    // Verify access
    const participant = await prisma.participant.findFirst({
      where: {
        meetingId: req.params.meetingId,
        userId: req.user!.id,
      },
    });

    if (!participant && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const minutes = await minutesService.generateMinutes(
      req.params.meetingId,
      options
    );

    return res.json(minutes);
  } catch (error) {
    return next(error);
  }
});

// Get minutes by ID
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const minutes = await minutesService.getMinutes(req.params.id);

    // Check access
    const participant = await prisma.participant.findFirst({
      where: {
        meetingId: minutes.meetingId,
        userId: req.user!.id,
      },
    });

    if (!participant && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json(minutes);
  } catch (error) {
    return next(error);
  }
});

// Get minutes for a meeting
router.get('/meeting/:meetingId', authenticate, async (req, res, next) => {
  try {
    const minutesList = await minutesService.getMinutesByMeeting(
      req.params.meetingId
    );
    return res.json(minutesList);
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// MINUTES EDITING & APPROVAL
// ============================================================================

// Update minutes
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const { summary, sections, keyPoints } = req.body;

    const minutes = await minutesService.updateMinutes(req.params.id, {
      summary,
      sections,
      keyPoints,
    });

    return res.json(minutes);
  } catch (error) {
    return next(error);
  }
});

// Approve minutes
router.post('/:id/approve', authenticate, async (req, res, next) => {
  try {
    // Verify user is host or admin
    const minutes = await minutesService.getMinutes(req.params.id);
    
    const participant = await prisma.participant.findFirst({
      where: {
        meetingId: minutes.meetingId,
        userId: req.user!.id,
        role: 'HOST',
      },
    });

    if (!participant && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only meeting hosts can approve minutes' });
    }

    const approved = await minutesService.approveMinutes(
      req.params.id,
      req.user!.id
    );

    return res.json(approved);
  } catch (error) {
    return next(error);
  }
});

// Publish minutes
router.post('/:id/publish', authenticate, async (req, res, next) => {
  try {
    const published = await minutesService.publishMinutes(req.params.id);
    return res.json(published);
  } catch (error) {
    return next(error);
  }
});

// Regenerate a section
router.post('/:id/regenerate-section', authenticate, async (req, res, next) => {
  try {
    const { sectionTitle, additionalContext } = req.body;

    if (!sectionTitle) {
      return res.status(400).json({ error: 'Section title is required' });
    }

    const section = await minutesService.regenerateSection(
      req.params.id,
      sectionTitle,
      additionalContext
    );

    return res.json(section);
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// ACTION ITEMS
// ============================================================================

// Get action items for current user
router.get('/action-items/my', authenticate, async (req, res, next) => {
  try {
    const actionItems = await minutesService.getActionItemsByUser(req.user!.id);
    return res.json(actionItems);
  } catch (error) {
    return next(error);
  }
});

// Get organization action items
router.get('/action-items/organization', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const { status, assigneeId, priority, dueBefore } = req.query;

    const actionItems = await minutesService.getActionItemsByOrganization(
      user.organizationId,
      {
        status: status as string,
        assigneeId: assigneeId as string,
        priority: priority as string,
        dueBefore: dueBefore ? new Date(dueBefore as string) : undefined,
      }
    );

    return res.json(actionItems);
  } catch (error) {
    return next(error);
  }
});

// Update action item
router.patch('/action-items/:id', authenticate, async (req, res, next) => {
  try {
    const { description, assigneeId, dueDate, priority, status } = req.body;

    const actionItem = await minutesService.updateActionItem(req.params.id, {
      description,
      assigneeId,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      priority,
      status,
    });

    return res.json(actionItem);
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// TEMPLATES
// ============================================================================

// Get templates
router.get('/templates', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return res.json([]);
    }

    const templates = await minutesService.getTemplates(user.organizationId);
    return res.json(templates);
  } catch (error) {
    return next(error);
  }
});

// Create template
router.post('/templates', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const template = await minutesService.createTemplate(
      user.organizationId,
      req.body
    );

    res.status(201).json(template);
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// SHARING
// ============================================================================

// Share minutes
router.post('/:id/share', authenticate, async (req, res, next) => {
  try {
    const { userIds, emails, message, includeRecording, includeTranscript } = req.body;

    await minutesService.shareMinutes(req.params.id, {
      userIds,
      emails,
      message,
      includeRecording,
      includeTranscript,
    });

    return res.json({ message: 'Minutes shared successfully' });
  } catch (error) {
    return next(error);
  }
});

export default router;
