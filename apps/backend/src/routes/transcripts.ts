// ============================================================================
// CHATVISTA - Transcript Routes
// API endpoints for transcript management
// ============================================================================

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { TranscriptionService } from '../services/TranscriptionService';
import { prisma } from '../lib/prisma';

const router: Router = Router();
const transcriptionService = new TranscriptionService();

// ============================================================================
// TRANSCRIPT CRUD
// ============================================================================

// Get transcript by ID
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const transcript = await transcriptionService.getTranscript(req.params.id);

    // Check access
    const participant = await prisma.participant.findFirst({
      where: {
        meetingId: transcript.meetingId,
        userId: req.user!.id,
      },
    });

    if (!participant && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json(transcript);
  } catch (error) {
    return next(error);
  }
});

// Get transcripts for a meeting
router.get('/meeting/:meetingId', authenticate, async (req, res, next) => {
  try {
    const transcripts = await transcriptionService.getTranscriptByMeeting(
      req.params.meetingId
    );
    return res.json(transcripts);
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// TRANSCRIPTION CONTROL
// ============================================================================

// Start transcription
router.post('/meeting/:meetingId/start', authenticate, async (req, res, next) => {
  try {
    const { language, options } = req.body;
    
    // Verify user is host or admin
    const participant = await prisma.participant.findFirst({
      where: {
        meetingId: req.params.meetingId,
        userId: req.user!.id,
        role: { in: ['HOST', 'CO_HOST'] },
      },
    });

    if (!participant && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only hosts can control transcription' });
    }

    const result = await transcriptionService.startTranscription(
      req.params.meetingId,
      language,
      options
    );

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// Stop transcription
router.post('/meeting/:meetingId/stop', authenticate, async (req, res, next) => {
  try {
    const participant = await prisma.participant.findFirst({
      where: {
        meetingId: req.params.meetingId,
        userId: req.user!.id,
        role: { in: ['HOST', 'CO_HOST'] },
      },
    });

    if (!participant && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only hosts can control transcription' });
    }

    await transcriptionService.stopTranscription(req.params.meetingId);

    return res.json({ message: 'Transcription stopped' });
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// SEARCH & EXPORT
// ============================================================================

// Search transcripts
router.get('/search', authenticate, async (req, res, next) => {
  try {
    const { q, meetingId, speakerId, from, to, limit } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    const results = await transcriptionService.searchTranscripts(
      user!.organizationId!,
      q as string,
      {
        meetingId: meetingId as string,
        speakerId: speakerId as string,
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      }
    );

    return res.json(results);
  } catch (error) {
    return next(error);
  }
});

// Export transcript
router.get('/:id/export', authenticate, async (req, res, next) => {
  try {
    const { format = 'txt' } = req.query;
    
    const validFormats = ['txt', 'srt', 'vtt', 'json'];
    if (!validFormats.includes(format as string)) {
      return res.status(400).json({ error: 'Invalid format' });
    }

    const content = await transcriptionService.exportTranscript(
      req.params.id,
      format as 'txt' | 'srt' | 'vtt' | 'json'
    );

    const contentTypes: Record<string, string> = {
      txt: 'text/plain',
      srt: 'application/x-subrip',
      vtt: 'text/vtt',
      json: 'application/json',
    };

    res.setHeader('Content-Type', contentTypes[format as string]);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="transcript.${format}"`
    );
    res.send(content);
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// EDITING
// ============================================================================

// Edit transcript segment
router.patch('/segments/:segmentId', authenticate, async (req, res, next) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    await transcriptionService.editSegment(
      req.params.segmentId,
      text,
      req.user!.id
    );

    return res.json({ message: 'Segment updated' });
  } catch (error) {
    return next(error);
  }
});

// Update speaker name
router.patch('/speakers/:speakerId', authenticate, async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    await transcriptionService.updateSpeakerName(req.params.speakerId, name);

    return res.json({ message: 'Speaker updated' });
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// TRANSLATION
// ============================================================================

// Translate transcript
router.post('/:id/translate', authenticate, async (req, res, next) => {
  try {
    const { targetLanguage } = req.body;

    if (!targetLanguage) {
      return res.status(400).json({ error: 'Target language is required' });
    }

    await transcriptionService.translateTranscript(
      req.params.id,
      targetLanguage
    );

    return res.json({ message: 'Translation complete' });
  } catch (error) {
    return next(error);
  }
});

export default router;
