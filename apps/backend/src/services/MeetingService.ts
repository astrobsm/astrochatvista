// ============================================================================
// CHATVISTA - Meeting Service
// ============================================================================

import { nanoid } from 'nanoid';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { safePublish, cache } from '../lib/redis';
import { config } from '../config';
import { AuditService } from './AuditService';
import { NotificationService } from './NotificationService';
import { AppError } from '../middleware/errorHandler';

interface CreateMeetingInput {
  title: string;
  description?: string;
  type?: string;
  hostId: string;
  organizationId: string;
  scheduledStartTime?: Date;
  scheduledEndTime?: Date;
  maxParticipants?: number;
  waitingRoomEnabled?: boolean;
  e2eEncrypted?: boolean;
  recordingEnabled?: boolean;
  transcriptionEnabled?: boolean;
  translationEnabled?: boolean;
  agenda?: any[];
  settings?: any;
}

interface JoinMeetingInput {
  meetingId: string;
  userId: string;
  accessCode?: string;
  displayName?: string;
  deviceInfo: any;
}

export class MeetingService {
  private auditService: AuditService;
  private notificationService: NotificationService;

  constructor() {
    this.auditService = new AuditService();
    this.notificationService = new NotificationService();
  }

  // ============================================================================
  // CREATE MEETING
  // ============================================================================

  async createMeeting(input: CreateMeetingInput) {
    const {
      title,
      description,
      type = 'SCHEDULED',
      hostId,
      organizationId,
      scheduledStartTime,
      scheduledEndTime,
      maxParticipants = 100,
      waitingRoomEnabled = true,
      e2eEncrypted = true,
      recordingEnabled = true,
      transcriptionEnabled = true,
      translationEnabled = false,
      agenda,
      settings,
    } = input;

    // Verify host exists
    const host = await prisma.user.findUnique({ where: { id: hostId } });
    if (!host) {
      throw new AppError('Host not found', 404);
    }

    // Check organization limits
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      throw new AppError('Organization not found', 404);
    }

    // Generate access code for meeting
    const accessCode = nanoid(8).toUpperCase();

    // Create meeting
    const meeting = await prisma.meeting.create({
      data: {
        title,
        description,
        type: type as any,
        status: type === 'INSTANT' ? 'IN_PROGRESS' : 'SCHEDULED',
        hostId,
        organizationId,
        scheduledStartTime,
        scheduledEndTime,
        actualStartTime: type === 'INSTANT' ? new Date() : undefined,
        timezone: host.timezone,
        accessCode,
        waitingRoomEnabled,
        e2eEncrypted,
        recordingEnabled,
        transcriptionEnabled,
        translationEnabled,
        maxParticipants: Math.min(maxParticipants, org.maxParticipants),
        settings: settings || this.getDefaultSettings(),
        agenda: agenda ? { items: agenda } : Prisma.JsonNull,
      },
      include: {
        host: {
          select: { id: true, displayName: true, email: true, avatarUrl: true },
        },
      },
    });

    // Audit log
    await this.auditService.log({
      actorId: hostId,
      actorRole: host.role,
      action: 'CREATE',
      resourceType: 'MEETING',
      resourceId: meeting.id,
      resourceName: title,
      result: 'SUCCESS',
      organizationId,
    });

    // Cache meeting state
    await cache.setMeetingState(meeting.id, {
      id: meeting.id,
      status: meeting.status,
      hostId,
      participantCount: 0,
      recordingActive: false,
      transcriptionActive: false,
    });

    return meeting;
  }

  // ============================================================================
  // GET MEETINGS
  // ============================================================================

  async getMeetings(params: {
    organizationId: string;
    userId: string;
    userRole: string;
    status?: string;
    type?: string;
    from?: Date;
    to?: Date;
    page: number;
    limit: number;
  }) {
    const { organizationId, userId, userRole, status, type, from, to, page, limit } = params;

    const where: any = { organizationId };

    // Non-admin users can only see their own meetings or meetings they're invited to
    if (!['SUPER_ADMIN', 'ORG_ADMIN'].includes(userRole)) {
      where.OR = [
        { hostId: userId },
        { participants: { some: { userId } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (from || to) {
      where.scheduledStartTime = {};
      if (from) where.scheduledStartTime.gte = from;
      if (to) where.scheduledStartTime.lte = to;
    }

    const [meetings, total] = await Promise.all([
      prisma.meeting.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { scheduledStartTime: 'desc' },
        include: {
          host: {
            select: { id: true, displayName: true, avatarUrl: true },
          },
          _count: { select: { participants: true } },
        },
      }),
      prisma.meeting.count({ where }),
    ]);

    return {
      meetings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================================================
  // GET MEETING BY ID
  // ============================================================================

  async getMeetingById(meetingId: string, _userId: string, organizationId: string) {
    const meeting = await prisma.meeting.findFirst({
      where: {
        id: meetingId,
        organizationId,
      },
      include: {
        host: {
          select: { id: true, displayName: true, email: true, avatarUrl: true },
        },
        participants: {
          where: { status: 'JOINED' },
          include: {
            user: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
        },
        recordings: {
          where: { status: { not: 'DELETED' } },
          select: { id: true, status: true, duration: true },
        },
        transcripts: {
          select: { id: true, status: true, language: true },
        },
      },
    });

    if (!meeting) {
      throw new AppError('Meeting not found', 404);
    }

    return meeting;
  }

  // ============================================================================
  // UPDATE MEETING
  // ============================================================================

  async updateMeeting(
    meetingId: string,
    updates: Partial<CreateMeetingInput>,
    userId: string,
    organizationId: string
  ) {
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, organizationId },
    });

    if (!meeting) {
      throw new AppError('Meeting not found', 404);
    }

    if (meeting.hostId !== userId) {
      throw new AppError('Only the host can update this meeting', 403);
    }

    if (meeting.status === 'ENDED' || meeting.status === 'CANCELLED') {
      throw new AppError('Cannot update ended or cancelled meetings', 400);
    }

    const updatedMeeting = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        title: updates.title,
        description: updates.description,
        scheduledStartTime: updates.scheduledStartTime,
        scheduledEndTime: updates.scheduledEndTime,
        settings: updates.settings,
        agenda: updates.agenda ? { items: updates.agenda } : undefined,
      },
      include: {
        host: {
          select: { id: true, displayName: true, email: true, avatarUrl: true },
        },
      },
    });

    // Notify participants of changes
    await this.notifyParticipants(meetingId, 'meeting.updated', {
      meetingId,
      title: updatedMeeting.title,
      scheduledStartTime: updatedMeeting.scheduledStartTime,
    });

    return updatedMeeting;
  }

  // ============================================================================
  // CANCEL MEETING
  // ============================================================================

  async cancelMeeting(meetingId: string, userId: string, organizationId: string) {
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, organizationId },
    });

    if (!meeting) {
      throw new AppError('Meeting not found', 404);
    }

    if (meeting.hostId !== userId) {
      throw new AppError('Only the host can cancel this meeting', 403);
    }

    if (meeting.status === 'IN_PROGRESS') {
      throw new AppError('Cannot cancel a meeting in progress. End it first.', 400);
    }

    await prisma.meeting.update({
      where: { id: meetingId },
      data: { status: 'CANCELLED' },
    });

    // Notify participants
    await this.notifyParticipants(meetingId, 'meeting.cancelled', {
      meetingId,
      title: meeting.title,
    });

    // Clear meeting cache
    await cache.del(`meeting:${meetingId}:state`);
  }

  // ============================================================================
  // START MEETING
  // ============================================================================

  async startMeeting(meetingId: string, userId: string) {
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId },
      include: { host: true },
    });

    if (!meeting) {
      throw new AppError('Meeting not found', 404);
    }

    if (meeting.hostId !== userId) {
      throw new AppError('Only the host can start this meeting', 403);
    }

    if (meeting.status === 'IN_PROGRESS') {
      return meeting;
    }

    if (meeting.status === 'ENDED' || meeting.status === 'CANCELLED') {
      throw new AppError('Cannot start an ended or cancelled meeting', 400);
    }

    const updatedMeeting = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: 'IN_PROGRESS',
        actualStartTime: new Date(),
      },
      include: {
        host: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    // Update meeting state in cache
    await cache.setMeetingState(meetingId, {
      id: meetingId,
      status: 'IN_PROGRESS',
      hostId: userId,
      startTime: new Date().toISOString(),
      participantCount: 0,
      recordingActive: false,
      transcriptionActive: meeting.transcriptionEnabled,
    });

    // Publish meeting started event
    await safePublish('meeting:events', JSON.stringify({
      type: 'meeting.started',
      meetingId,
      timestamp: new Date().toISOString(),
    }));

    // Notify invited participants
    await this.notifyParticipants(meetingId, 'meeting.started', {
      meetingId,
      title: meeting.title,
      joinUrl: `${config.appUrl}/join/${meeting.roomId}`,
    });

    return updatedMeeting;
  }

  // ============================================================================
  // END MEETING
  // ============================================================================

  async endMeeting(meetingId: string, userId: string) {
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId },
      include: {
        participants: true,
        recordings: { where: { status: 'RECORDING' } },
      },
    });

    if (!meeting) {
      throw new AppError('Meeting not found', 404);
    }

    if (meeting.hostId !== userId) {
      throw new AppError('Only the host can end this meeting', 403);
    }

    if (meeting.status !== 'IN_PROGRESS') {
      throw new AppError('Meeting is not in progress', 400);
    }

    const endTime = new Date();
    const duration = meeting.actualStartTime
      ? Math.round((endTime.getTime() - meeting.actualStartTime.getTime()) / 1000)
      : 0;

    // Update meeting status
    const updatedMeeting = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: 'ENDED',
        actualEndTime: endTime,
      },
      include: {
        participants: true,
      },
    });

    // Update all active participants to LEFT
    await prisma.participant.updateMany({
      where: { meetingId, status: 'JOINED' },
      data: { status: 'LEFT', leftAt: endTime },
    });

    // Stop any active recordings
    if (meeting.recordings.length > 0) {
      await prisma.recording.updateMany({
        where: { meetingId, status: 'RECORDING' },
        data: { status: 'PROCESSING', endTime, duration },
      });
    }

    // Clear meeting state from cache
    await cache.del(`meeting:${meetingId}:state`);
    await cache.del(`meeting:${meetingId}:participants`);

    // Publish meeting ended event
    await safePublish('meeting:events', JSON.stringify({
      type: 'meeting.ended',
      meetingId,
      duration,
      timestamp: endTime.toISOString(),
    }));

    return updatedMeeting;
  }

  // ============================================================================
  // JOIN MEETING
  // ============================================================================

  async joinMeeting(input: JoinMeetingInput) {
    const { meetingId, userId, accessCode, displayName, deviceInfo } = input;

    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId },
      include: { host: true, organization: true },
    });

    if (!meeting) {
      throw new AppError('Meeting not found', 404);
    }

    // Check meeting status
    if (meeting.status === 'ENDED' || meeting.status === 'CANCELLED') {
      throw new AppError('This meeting has ended', 400);
    }

    // Verify access code if required
    if (meeting.accessCode && accessCode !== meeting.accessCode) {
      throw new AppError('Invalid access code', 403);
    }

    // Get user info
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Check participant limit
    const currentParticipants = await prisma.participant.count({
      where: { meetingId, status: 'JOINED' },
    });

    if (currentParticipants >= meeting.maxParticipants) {
      throw new AppError('Meeting is full', 400);
    }

    // Determine participant role
    let role = 'PARTICIPANT';
    if (userId === meeting.hostId) {
      role = 'HOST';
    }

    // Determine initial status
    const initialStatus = meeting.waitingRoomEnabled && role !== 'HOST' 
      ? 'WAITING' 
      : 'JOINED';

    // Create or update participant
    const participant = await prisma.participant.upsert({
      where: {
        id: `${meetingId}-${userId}`, // Composite key alternative
      },
      create: {
        meetingId,
        userId,
        displayName: displayName || user.displayName,
        email: user.email,
        role: role as any,
        status: initialStatus as any,
        joinedAt: initialStatus === 'JOINED' ? new Date() : undefined,
        deviceInfo,
      },
      update: {
        status: initialStatus as any,
        joinedAt: initialStatus === 'JOINED' ? new Date() : undefined,
        leftAt: null,
        deviceInfo,
      },
    });

    // Add to cache
    await cache.addParticipant(meetingId, participant.id, {
      id: participant.id,
      userId,
      displayName: participant.displayName,
      role: participant.role,
      status: participant.status,
      audioEnabled: false,
      videoEnabled: false,
    });

    // Publish participant joined event
    if (initialStatus === 'JOINED') {
      await safePublish('meeting:events', JSON.stringify({
        type: 'participant.joined',
        meetingId,
        participantId: participant.id,
        displayName: participant.displayName,
        timestamp: new Date().toISOString(),
      }));
    }

    // Get WebRTC configuration
    const rtcConfig = {
      iceServers: config.webrtc.iceServers,
      roomId: meeting.roomId,
    };

    return {
      participant,
      meeting: {
        id: meeting.id,
        title: meeting.title,
        roomId: meeting.roomId,
        status: meeting.status,
        settings: meeting.settings,
        e2eEncrypted: meeting.e2eEncrypted,
        recordingEnabled: meeting.recordingEnabled,
        transcriptionEnabled: meeting.transcriptionEnabled,
      },
      rtcConfig,
      status: initialStatus,
      waitingRoom: initialStatus === 'WAITING',
    };
  }

  // ============================================================================
  // LEAVE MEETING
  // ============================================================================

  async leaveMeeting(meetingId: string, userId: string) {
    const participant = await prisma.participant.findFirst({
      where: { meetingId, userId, status: 'JOINED' },
    });

    if (!participant) {
      throw new AppError('You are not in this meeting', 400);
    }

    await prisma.participant.update({
      where: { id: participant.id },
      data: {
        status: 'LEFT',
        leftAt: new Date(),
      },
    });

    // Remove from cache
    await cache.removeParticipant(meetingId, participant.id);

    // Publish participant left event
    await safePublish('meeting:events', JSON.stringify({
      type: 'participant.left',
      meetingId,
      participantId: participant.id,
      timestamp: new Date().toISOString(),
    }));
  }

  // ============================================================================
  // PARTICIPANT MANAGEMENT
  // ============================================================================

  async getParticipants(meetingId: string, _organizationId: string) {
    // Try cache first
    const cached = await cache.getParticipants(meetingId);
    if (Object.keys(cached).length > 0) {
      return Object.values(cached);
    }

    // Fallback to database
    return prisma.participant.findMany({
      where: { meetingId, status: { in: ['JOINED', 'WAITING'] } },
      include: {
        user: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });
  }

  async admitParticipant(meetingId: string, participantId: string, hostId: string) {
    await this.verifyHost(meetingId, hostId);

    const participant = await prisma.participant.update({
      where: { id: participantId },
      data: {
        status: 'JOINED',
        joinedAt: new Date(),
      },
    });

    // Publish event
    await safePublish('meeting:events', JSON.stringify({
      type: 'participant.admitted',
      meetingId,
      participantId,
      timestamp: new Date().toISOString(),
    }));

    return participant;
  }

  async removeParticipant(meetingId: string, participantId: string, hostId: string) {
    await this.verifyHost(meetingId, hostId);

    await prisma.participant.update({
      where: { id: participantId },
      data: {
        status: 'REMOVED',
        leftAt: new Date(),
      },
    });

    await cache.removeParticipant(meetingId, participantId);

    // Publish event
    await safePublish('meeting:events', JSON.stringify({
      type: 'participant.removed',
      meetingId,
      participantId,
      timestamp: new Date().toISOString(),
    }));
  }

  async muteParticipant(
    meetingId: string,
    participantId: string,
    type: 'audio' | 'video',
    muted: boolean,
    hostId: string
  ) {
    await this.verifyHost(meetingId, hostId);

    const updateData = type === 'audio'
      ? { audioEnabled: !muted }
      : { videoEnabled: !muted };

    await prisma.participant.update({
      where: { id: participantId },
      data: updateData,
    });

    // Publish event
    await safePublish('meeting:events', JSON.stringify({
      type: `participant.${type}.${muted ? 'muted' : 'unmuted'}`,
      meetingId,
      participantId,
      timestamp: new Date().toISOString(),
    }));
  }

  // ============================================================================
  // RECORDING CONTROL
  // ============================================================================

  async getRecordingStatus(meetingId: string, _organizationId: string) {
    const recordings = await prisma.recording.findMany({
      where: { meetingId },
      orderBy: { createdAt: 'desc' },
    });

    const activeRecording = recordings.find((r: { status: string }) => 
      ['RECORDING', 'PAUSED'].includes(r.status)
    );

    return {
      isRecording: !!activeRecording,
      status: activeRecording?.status,
      startTime: activeRecording?.startTime,
      recordings: recordings.map((r: { id: string; status: string; duration: number | null; createdAt: Date }) => ({
        id: r.id,
        status: r.status,
        duration: r.duration,
        createdAt: r.createdAt,
      })),
    };
  }

  async controlRecording(
    meetingId: string,
    action: 'start' | 'stop' | 'pause' | 'resume',
    userId: string
  ) {
    const meeting = await this.verifyHost(meetingId, userId);

    if (!meeting.recordingEnabled) {
      throw new AppError('Recording is not enabled for this meeting', 400);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    switch (action) {
      case 'start':
        const newRecording = await prisma.recording.create({
          data: {
            meetingId,
            type: 'CLOUD',
            status: 'RECORDING',
            startTime: new Date(),
            createdById: userId,
          },
        });

        // Update cache
        const state = await cache.getMeetingState<any>(meetingId);
        if (state) {
          await cache.setMeetingState(meetingId, {
            ...state,
            recordingActive: true,
            recordingId: newRecording.id,
          });
        }

        await this.auditService.log({
          actorId: userId,
          actorRole: user!.role,
          action: 'START_RECORDING',
          resourceType: 'MEETING',
          resourceId: meetingId,
          result: 'SUCCESS',
          organizationId: meeting.organizationId,
        });

        return { recording: newRecording, message: 'Recording started' };

      case 'stop':
        const recording = await prisma.recording.findFirst({
          where: { meetingId, status: { in: ['RECORDING', 'PAUSED'] } },
        });

        if (!recording) {
          throw new AppError('No active recording found', 400);
        }

        const duration = Math.round(
          (Date.now() - recording.startTime.getTime()) / 1000
        );

        await prisma.recording.update({
          where: { id: recording.id },
          data: { status: 'PROCESSING', endTime: new Date(), duration },
        });

        await this.auditService.log({
          actorId: userId,
          actorRole: user!.role,
          action: 'STOP_RECORDING',
          resourceType: 'MEETING',
          resourceId: meetingId,
          result: 'SUCCESS',
          organizationId: meeting.organizationId,
        });

        return { message: 'Recording stopped and processing' };

      case 'pause':
      case 'resume':
        const activeRecording = await prisma.recording.findFirst({
          where: { meetingId, status: action === 'pause' ? 'RECORDING' : 'PAUSED' },
        });

        if (!activeRecording) {
          throw new AppError('No active recording to ' + action, 400);
        }

        await prisma.recording.update({
          where: { id: activeRecording.id },
          data: { status: action === 'pause' ? 'PAUSED' : 'RECORDING' },
        });

        return { message: `Recording ${action}d` };
    }
  }

  // ============================================================================
  // WEBRTC CONFIGURATION
  // ============================================================================

  async getWebRTCConfig(meetingId: string, _userId: string) {
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId },
    });

    if (!meeting) {
      throw new AppError('Meeting not found', 404);
    }

    return {
      iceServers: config.webrtc.iceServers,
      roomId: meeting.roomId,
      mediasoup: {
        serverUrl: config.apiUrl.replace('http', 'ws'),
      },
      e2eEncryption: meeting.e2eEncrypted,
    };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private async verifyHost(meetingId: string, userId: string) {
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId },
    });

    if (!meeting) {
      throw new AppError('Meeting not found', 404);
    }

    if (meeting.hostId !== userId) {
      // Check if user is co-host
      const participant = await prisma.participant.findFirst({
        where: { meetingId, userId, role: 'CO_HOST' },
      });

      if (!participant) {
        throw new AppError('Host privileges required', 403);
      }
    }

    return meeting;
  }

  private async notifyParticipants(meetingId: string, event: string, data: any) {
    const participants = await prisma.participant.findMany({
      where: { meetingId },
      include: { user: true },
    });

    for (const participant of participants) {
      if (participant.user) {
        await this.notificationService.send({
          userId: participant.user.id,
          type: event as any,
          title: data.title || 'Meeting Update',
          message: `Meeting "${data.title}" has been updated`,
          data,
        });
      }
    }
  }

  private getDefaultSettings() {
    return {
      allowJoinBeforeHost: false,
      muteParticipantsOnEntry: true,
      disableVideo: false,
      allowScreenShare: true,
      screenSharePermission: 'ALL_PARTICIPANTS',
      allowChat: true,
      chatPermission: 'EVERYONE',
      allowReactions: true,
      allowRaiseHand: true,
      allowPolls: true,
      allowWhiteboard: true,
      allowBreakoutRooms: true,
      allowRecording: true,
      recordingAutoStart: false,
      allowLiveStream: false,
      interpretationEnabled: false,
      interpretationLanguages: [],
      focusModeEnabled: false,
    };
  }
}
