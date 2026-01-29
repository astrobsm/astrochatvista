// ============================================================================
// CHATVISTA - Meeting Routes
// ============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticate, requireHostRole } from '../middleware/auth';
import { MeetingService } from '../services/MeetingService';
import { logger } from '../utils/logger';

const router: Router = Router();
const meetingService = new MeetingService();

const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

// ============================================================================
// CREATE MEETING
// ============================================================================

router.post(
  '/',
  authenticate,
  requireHostRole,
  [
    body('title').trim().notEmpty().withMessage('Meeting title is required'),
    body('type').optional().isIn([
      'INSTANT', 'SCHEDULED', 'RECURRING', 'WEBINAR', 
      'BREAKOUT', 'TRAINING', 'INTERVIEW', 'BOARD_MEETING'
    ]),
    body('scheduledStartTime').optional().isISO8601().toDate(),
    body('scheduledEndTime').optional().isISO8601().toDate(),
    body('maxParticipants').optional().isInt({ min: 2, max: 1000 }),
    body('waitingRoomEnabled').optional().isBoolean(),
    body('e2eEncrypted').optional().isBoolean(),
    body('recordingEnabled').optional().isBoolean(),
    body('transcriptionEnabled').optional().isBoolean(),
    body('agenda').optional().isArray(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meeting = await meetingService.createMeeting({
        ...req.body,
        hostId: req.user!.id,
        organizationId: req.user!.organizationId,
      });

      logger.info(`Meeting created: ${meeting.id} by ${req.user!.email}`);

      res.status(201).json({
        message: 'Meeting created successfully',
        meeting,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET ALL MEETINGS
// ============================================================================

router.get(
  '/',
  authenticate,
  [
    query('status').optional().isIn([
      'SCHEDULED', 'WAITING_ROOM', 'IN_PROGRESS', 'ON_HOLD', 'ENDED', 'CANCELLED'
    ]),
    query('type').optional().isIn([
      'INSTANT', 'SCHEDULED', 'RECURRING', 'WEBINAR', 
      'BREAKOUT', 'TRAINING', 'INTERVIEW', 'BOARD_MEETING'
    ]),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, type, from, to, page = 1, limit = 20 } = req.query;

      const result = await meetingService.getMeetings({
        organizationId: req.user!.organizationId,
        userId: req.user!.id,
        userRole: req.user!.role,
        status: status as string,
        type: type as string,
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined,
        page: Number(page),
        limit: Number(limit),
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET MEETING BY ID
// ============================================================================

router.get(
  '/:meetingId',
  authenticate,
  [param('meetingId').isUUID()],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meeting = await meetingService.getMeetingById(
        req.params.meetingId,
        req.user!.id,
        req.user!.organizationId
      );

      res.json({ meeting });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// UPDATE MEETING
// ============================================================================

router.patch(
  '/:meetingId',
  authenticate,
  requireHostRole,
  [
    param('meetingId').isUUID(),
    body('title').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('scheduledStartTime').optional().isISO8601().toDate(),
    body('scheduledEndTime').optional().isISO8601().toDate(),
    body('settings').optional().isObject(),
    body('agenda').optional().isArray(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meeting = await meetingService.updateMeeting(
        req.params.meetingId,
        req.body,
        req.user!.id,
        req.user!.organizationId
      );

      logger.info(`Meeting updated: ${meeting.id} by ${req.user!.email}`);

      res.json({
        message: 'Meeting updated successfully',
        meeting,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// DELETE/CANCEL MEETING
// ============================================================================

router.delete(
  '/:meetingId',
  authenticate,
  requireHostRole,
  [param('meetingId').isUUID()],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await meetingService.cancelMeeting(
        req.params.meetingId,
        req.user!.id,
        req.user!.organizationId
      );

      logger.info(`Meeting cancelled: ${req.params.meetingId} by ${req.user!.email}`);

      res.json({ message: 'Meeting cancelled successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// START MEETING
// ============================================================================

router.post(
  '/:meetingId/start',
  authenticate,
  requireHostRole,
  [param('meetingId').isUUID()],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meeting = await meetingService.startMeeting(
        req.params.meetingId,
        req.user!.id
      );

      logger.info(`Meeting started: ${meeting.id} by ${req.user!.email}`);

      res.json({
        message: 'Meeting started',
        meeting,
        joinInfo: {
          roomId: meeting.roomId,
          accessCode: meeting.accessCode,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// END MEETING
// ============================================================================

router.post(
  '/:meetingId/end',
  authenticate,
  requireHostRole,
  [param('meetingId').isUUID()],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meeting = await meetingService.endMeeting(
        req.params.meetingId,
        req.user!.id
      );

      logger.info(`Meeting ended: ${meeting.id} by ${req.user!.email}`);

      res.json({
        message: 'Meeting ended',
        meeting,
        summary: {
          duration: meeting.actualEndTime && meeting.actualStartTime
            ? Math.round((meeting.actualEndTime.getTime() - meeting.actualStartTime.getTime()) / 1000 / 60)
            : 0,
          participantCount: meeting.participants?.length || 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// JOIN MEETING
// ============================================================================

router.post(
  '/:meetingId/join',
  authenticate,
  [
    param('meetingId').isUUID(),
    body('accessCode').optional().isString(),
    body('displayName').optional().trim(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { accessCode, displayName } = req.body;

      const result = await meetingService.joinMeeting({
        meetingId: req.params.meetingId,
        userId: req.user!.id,
        accessCode,
        displayName,
        deviceInfo: {
          userAgent: req.headers['user-agent'],
          ip: req.ip,
        },
      });

      logger.info(`User ${req.user!.email} joined meeting ${req.params.meetingId}`);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// LEAVE MEETING
// ============================================================================

router.post(
  '/:meetingId/leave',
  authenticate,
  [param('meetingId').isUUID()],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await meetingService.leaveMeeting(
        req.params.meetingId,
        req.user!.id
      );

      logger.info(`User ${req.user!.email} left meeting ${req.params.meetingId}`);

      res.json({ message: 'Left meeting successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET PARTICIPANTS
// ============================================================================

router.get(
  '/:meetingId/participants',
  authenticate,
  [param('meetingId').isUUID()],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const participants = await meetingService.getParticipants(
        req.params.meetingId,
        req.user!.organizationId
      );

      res.json({ participants });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// ADMIT PARTICIPANT FROM WAITING ROOM
// ============================================================================

router.post(
  '/:meetingId/participants/:participantId/admit',
  authenticate,
  requireHostRole,
  [
    param('meetingId').isUUID(),
    param('participantId').isUUID(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await meetingService.admitParticipant(
        req.params.meetingId,
        req.params.participantId,
        req.user!.id
      );

      res.json({ message: 'Participant admitted' });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// REMOVE PARTICIPANT
// ============================================================================

router.post(
  '/:meetingId/participants/:participantId/remove',
  authenticate,
  requireHostRole,
  [
    param('meetingId').isUUID(),
    param('participantId').isUUID(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await meetingService.removeParticipant(
        req.params.meetingId,
        req.params.participantId,
        req.user!.id
      );

      res.json({ message: 'Participant removed' });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// MUTE/UNMUTE PARTICIPANT
// ============================================================================

router.post(
  '/:meetingId/participants/:participantId/mute',
  authenticate,
  requireHostRole,
  [
    param('meetingId').isUUID(),
    param('participantId').isUUID(),
    body('type').isIn(['audio', 'video']),
    body('muted').isBoolean(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, muted } = req.body;

      await meetingService.muteParticipant(
        req.params.meetingId,
        req.params.participantId,
        type,
        muted,
        req.user!.id
      );

      res.json({ message: `Participant ${muted ? 'muted' : 'unmuted'}` });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET MEETING RECORDING STATUS
// ============================================================================

router.get(
  '/:meetingId/recording',
  authenticate,
  [param('meetingId').isUUID()],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const recordingStatus = await meetingService.getRecordingStatus(
        req.params.meetingId,
        req.user!.organizationId
      );

      res.json(recordingStatus);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// START/STOP RECORDING
// ============================================================================

router.post(
  '/:meetingId/recording/:action',
  authenticate,
  requireHostRole,
  [
    param('meetingId').isUUID(),
    param('action').isIn(['start', 'stop', 'pause', 'resume']),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await meetingService.controlRecording(
        req.params.meetingId,
        req.params.action as 'start' | 'stop' | 'pause' | 'resume',
        req.user!.id
      );

      logger.info(`Recording ${req.params.action}: ${req.params.meetingId} by ${req.user!.email}`);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET WEBRTC CONFIGURATION
// ============================================================================

router.get(
  '/:meetingId/rtc-config',
  authenticate,
  [param('meetingId').isUUID()],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const config = await meetingService.getWebRTCConfig(
        req.params.meetingId,
        req.user!.id
      );

      res.json(config);
    } catch (error) {
      next(error);
    }
  }
);

export { router as meetingsRouter };
