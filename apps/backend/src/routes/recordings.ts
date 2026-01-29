// ============================================================================
// CHATVISTA - Recording Routes
// API endpoints for recording management
// ============================================================================

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { RecordingService } from '../services/RecordingService';
import { prisma } from '../lib/prisma';

const router: Router = Router();
const recordingService = new RecordingService();

// ============================================================================
// RECORDING CONTROL
// ============================================================================

// Start recording
router.post('/meeting/:meetingId/start', authenticate, async (req, res, next) => {
  try {
    // Verify user is host
    const participant = await prisma.participant.findFirst({
      where: {
        meetingId: req.params.meetingId,
        userId: req.user!.id,
        role: { in: ['HOST', 'CO_HOST'] },
      },
    });

    if (!participant && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only hosts can start recording' });
    }

    const { config } = req.body;
    const result = await recordingService.startRecording(
      req.params.meetingId,
      req.user!.id,
      config
    );

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// Pause recording
router.post('/meeting/:meetingId/pause', authenticate, async (req, res, next) => {
  try {
    await recordingService.pauseRecording(req.params.meetingId);
    return res.json({ message: 'Recording paused' });
  } catch (error) {
    return next(error);
  }
});

// Resume recording
router.post('/meeting/:meetingId/resume', authenticate, async (req, res, next) => {
  try {
    await recordingService.resumeRecording(req.params.meetingId);
    return res.json({ message: 'Recording resumed' });
  } catch (error) {
    return next(error);
  }
});

// Stop recording
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
      return res.status(403).json({ error: 'Only hosts can stop recording' });
    }

    const result = await recordingService.stopRecording(req.params.meetingId);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// RETRIEVAL
// ============================================================================

// Get recording by ID
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const recording = await recordingService.getRecording(req.params.id);

    // Check access
    const participant = await prisma.participant.findFirst({
      where: {
        meetingId: recording.meetingId,
        userId: req.user!.id,
      },
    });

    if (!participant && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json(recording);
  } catch (error) {
    return next(error);
  }
});

// Get recordings for a meeting
router.get('/meeting/:meetingId', authenticate, async (req, res, next) => {
  try {
    const recordings = await recordingService.getRecordingsByMeeting(
      req.params.meetingId
    );
    return res.json(recordings);
  } catch (error) {
    return next(error);
  }
});

// Get organization recordings
router.get('/', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return res.json({ recordings: [], total: 0 });
    }

    const { status, from, to, limit, offset } = req.query;

    const result = await recordingService.getRecordingsByOrganization(
      user.organizationId,
      {
        status: status as string,
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      }
    );

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// Get playback URL
router.get('/:id/playback', authenticate, async (req, res, next) => {
  try {
    const { quality } = req.query;
    const result = await recordingService.getPlaybackUrl(
      req.params.id,
      quality as string
    );
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// MANAGEMENT
// ============================================================================

// Delete recording
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const recording = await recordingService.getRecording(req.params.id);

    // Verify permissions
    const meeting = await prisma.meeting.findUnique({
      where: { id: recording.meetingId },
    });

    if (meeting?.hostId !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only meeting host or admin can delete recordings' });
    }

    await recordingService.deleteRecording(req.params.id);
    return res.json({ message: 'Recording deleted' });
  } catch (error) {
    return next(error);
  }
});

// Get recording analytics
router.get('/:id/analytics', authenticate, async (req, res, next) => {
  try {
    const analytics = await recordingService.getRecordingAnalytics(req.params.id);
    return res.json(analytics);
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// SHARING
// ============================================================================

// Share recording
router.post('/:id/share', authenticate, async (req, res, next) => {
  try {
    const { expiresIn, password, allowDownload, notifyEmails } = req.body;

    const result = await recordingService.shareRecording(req.params.id, {
      expiresIn,
      password,
      allowDownload,
      notifyEmails,
    });

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// Access shared recording
router.get('/shared/:shareId', async (req, res, next) => {
  try {
    const { password } = req.query;

    const result = await recordingService.validateShareAccess(
      req.params.shareId,
      password as string
    );

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// Get playback URL for shared recording
router.get('/shared/:shareId/playback', async (req, res, next) => {
  try {
    const { password, quality } = req.query;

    const { recording } = await recordingService.validateShareAccess(
      req.params.shareId,
      password as string
    );

    const result = await recordingService.getPlaybackUrl(
      recording.id,
      quality as string
    );

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

export default router;
