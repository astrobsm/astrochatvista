// ============================================================================
// CHATVISTA - Export Routes
// API endpoints for PDF/document export
// ============================================================================

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { ExportService } from '../services/ExportService';
import { prisma } from '../lib/prisma';

const router: Router = Router();
const exportService = new ExportService();

// ============================================================================
// MINUTES EXPORT
// ============================================================================

// Export meeting minutes as PDF
router.post('/minutes/:minutesId', authenticate, async (req, res, next) => {
  try {
    const { config } = req.body;

    // Verify access
    const minutes = await prisma.meetingMinutes.findUnique({
      where: { id: req.params.minutesId },
      include: { meeting: true },
    });

    if (!minutes) {
      return res.status(404).json({ error: 'Minutes not found' });
    }

    const participant = await prisma.participant.findFirst({
      where: {
        meetingId: minutes.meetingId,
        userId: req.user!.id,
      },
    });

    if (!participant && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await exportService.exportMeetingMinutes(
      req.params.minutesId,
      config
    );

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// TRANSCRIPT EXPORT
// ============================================================================

// Export transcript as PDF
router.post('/transcripts/:transcriptId', authenticate, async (req, res, next) => {
  try {
    const { config } = req.body;

    const transcript = await prisma.transcript.findUnique({
      where: { id: req.params.transcriptId },
    });

    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    const participant = await prisma.participant.findFirst({
      where: {
        meetingId: transcript.meetingId,
        userId: req.user!.id,
      },
    });

    if (!participant && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await exportService.exportTranscript(
      req.params.transcriptId,
      config
    );

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// BATCH EXPORT
// ============================================================================

// Export multiple meetings
router.post('/batch', authenticate, async (req, res, next) => {
  try {
    const { meetingIds, exportType, config } = req.body;

    if (!meetingIds || !Array.isArray(meetingIds) || meetingIds.length === 0) {
      return res.status(400).json({ error: 'Meeting IDs are required' });
    }

    const result = await exportService.batchExport(
      meetingIds,
      exportType || 'both',
      config
    );

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// EXPORT HISTORY
// ============================================================================

// Get export history
router.get('/history', authenticate, async (req, res, next) => {
  try {
    const { type, limit, offset } = req.query;

    const where: any = { createdById: req.user!.id };
    if (type) where.format = type;

    const exports = await prisma.exportedDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit as string) : 50,
      skip: offset ? parseInt(offset as string) : 0,
    });

    return res.json(exports);
  } catch (error) {
    return next(error);
  }
});

// Get export by ID
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const exportRecord = await prisma.exportedDocument.findUnique({
      where: { id: req.params.id },
    });

    if (!exportRecord) {
      return res.status(404).json({ error: 'Export not found' });
    }

    return res.json(exportRecord);
  } catch (error) {
    return next(error);
  }
});

export default router;
