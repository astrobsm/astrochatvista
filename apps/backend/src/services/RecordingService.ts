// ============================================================================
// CHATVISTA - Recording Service
// Cloud recording with transcoding and storage
// ============================================================================

import { prisma } from '../lib/prisma';
import { safePublish } from '../lib/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { spawn } from 'child_process';
import { createWriteStream, createReadStream, unlink } from 'fs';
import { promisify } from 'util';
import { join } from 'path';
import { randomUUID } from 'crypto';

const unlinkAsync = promisify(unlink);

interface RecordingConfig {
  format: 'webm' | 'mp4' | 'mkv';
  quality: 'low' | 'medium' | 'high' | 'source';
  resolution?: string;
  frameRate?: number;
  videoBitrate?: number;
  audioBitrate?: number;
  includeScreenShare: boolean;
  includeAudio: boolean;
  layout: 'grid' | 'speaker' | 'presentation' | 'custom';
  maxDuration?: number; // in seconds
}

interface RecordingSession {
  id: string;
  meetingId: string;
  recordingId: string;
  startTime: number;
  config: RecordingConfig;
  tempFilePath: string;
  isActive: boolean;
  segments: Buffer[];
}

interface RecordingOutput {
  quality: string;
  format: string;
  resolution: string;
  fileSize: number;
  url: string;
}

const defaultConfig: RecordingConfig = {
  format: 'webm',
  quality: 'high',
  resolution: '1920x1080',
  frameRate: 30,
  videoBitrate: 4000,
  audioBitrate: 128,
  includeScreenShare: true,
  includeAudio: true,
  layout: 'grid',
};

const qualityPresets = {
  low: { resolution: '640x360', videoBitrate: 500, audioBitrate: 64 },
  medium: { resolution: '1280x720', videoBitrate: 2000, audioBitrate: 96 },
  high: { resolution: '1920x1080', videoBitrate: 4000, audioBitrate: 128 },
  source: { resolution: 'original', videoBitrate: 8000, audioBitrate: 192 },
};

export class RecordingService {
  private s3Client: S3Client;
  private bucket: string;
  private sessions: Map<string, RecordingSession> = new Map();
  private tempDir: string;

  constructor() {
    this.s3Client = new S3Client({
      endpoint: config.minioEndpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: config.minioAccessKey,
        secretAccessKey: config.minioSecretKey,
      },
      forcePathStyle: true,
    });
    this.bucket = (config as any).minioBucket || 'chatvista-recordings';
    this.tempDir = (config as any).tempDir || '/tmp/chatvista-recordings';
  }

  // ============================================================================
  // RECORDING LIFECYCLE
  // ============================================================================

  async startRecording(
    meetingId: string,
    startedBy: string,
    configOverrides: Partial<RecordingConfig> = {}
  ): Promise<{ recordingId: string }> {
    // Check if already recording
    if (this.sessions.has(meetingId)) {
      const session = this.sessions.get(meetingId)!;
      return { recordingId: session.recordingId };
    }

    // Check meeting exists
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      throw new AppError('Meeting not found', 404);
    }

    // Merge config with defaults
    const recordingConfig: RecordingConfig = {
      ...defaultConfig,
      ...configOverrides,
      ...qualityPresets[configOverrides.quality || 'high'],
    };

    // Create recording record
    const recording = await prisma.recording.create({
      data: {
        meetingId,
        startedBy,
        status: 'RECORDING',
        format: recordingConfig.format,
        quality: recordingConfig.quality,
        layout: recordingConfig.layout,
        settings: recordingConfig,
      },
    });

    // Initialize session
    const sessionId = randomUUID();
    const tempFilePath = join(this.tempDir, `${sessionId}.webm`);

    const session: RecordingSession = {
      id: sessionId,
      meetingId,
      recordingId: recording.id,
      startTime: Date.now(),
      config: recordingConfig,
      tempFilePath,
      isActive: true,
      segments: [],
    };

    this.sessions.set(meetingId, session);

    logger.info(`Recording started for meeting ${meetingId}`);

    // Broadcast event
    await safePublish('meeting:events', JSON.stringify({
      type: 'recording.started',
      meetingId,
      recordingId: recording.id,
      startedBy,
      timestamp: new Date().toISOString(),
    }));

    return { recordingId: recording.id };
  }

  async addMediaChunk(
    meetingId: string,
    chunk: Buffer,
    _streamType: 'video' | 'audio' | 'screen'
  ): Promise<void> {
    const session = this.sessions.get(meetingId);
    if (!session || !session.isActive) return;

    // Add chunk to segments
    session.segments.push(chunk);

    // Write to temp file periodically
    if (session.segments.length >= 10) {
      await this.flushSegments(session);
    }
  }

  private async flushSegments(session: RecordingSession): Promise<void> {
    if (session.segments.length === 0) return;

    const data = Buffer.concat(session.segments);
    const stream = createWriteStream(session.tempFilePath, { flags: 'a' });
    
    await new Promise<void>((resolve, reject) => {
      stream.write(data, (err) => {
        if (err) reject(err);
        else resolve();
      });
      stream.end();
    });

    session.segments = [];
  }

  async pauseRecording(meetingId: string): Promise<void> {
    const session = this.sessions.get(meetingId);
    if (!session) {
      throw new AppError('No active recording for this meeting', 404);
    }

    session.isActive = false;

    await prisma.recording.update({
      where: { id: session.recordingId },
      data: { status: 'PAUSED' },
    });

    await safePublish('meeting:events', JSON.stringify({
      type: 'recording.paused',
      meetingId,
      recordingId: session.recordingId,
      timestamp: new Date().toISOString(),
    }));
  }

  async resumeRecording(meetingId: string): Promise<void> {
    const session = this.sessions.get(meetingId);
    if (!session) {
      throw new AppError('No recording session for this meeting', 404);
    }

    session.isActive = true;

    await prisma.recording.update({
      where: { id: session.recordingId },
      data: { status: 'RECORDING' },
    });

    await safePublish('meeting:events', JSON.stringify({
      type: 'recording.resumed',
      meetingId,
      recordingId: session.recordingId,
      timestamp: new Date().toISOString(),
    }));
  }

  async stopRecording(meetingId: string): Promise<{ recordingId: string }> {
    const session = this.sessions.get(meetingId);
    if (!session) {
      throw new AppError('No active recording for this meeting', 404);
    }

    session.isActive = false;

    // Flush remaining segments
    await this.flushSegments(session);

    const duration = Math.round((Date.now() - session.startTime) / 1000);

    // Update recording status to processing
    await prisma.recording.update({
      where: { id: session.recordingId },
      data: {
        status: 'PROCESSING',
        duration,
        endedAt: new Date(),
      },
    });

    // Start async processing
    this.processRecording(session).catch((err) => {
      logger.error('Recording processing error:', err);
    });

    this.sessions.delete(meetingId);

    logger.info(`Recording stopped for meeting ${meetingId}`);

    await safePublish('meeting:events', JSON.stringify({
      type: 'recording.stopped',
      meetingId,
      recordingId: session.recordingId,
      timestamp: new Date().toISOString(),
    }));

    return { recordingId: session.recordingId };
  }

  // ============================================================================
  // RECORDING PROCESSING
  // ============================================================================

  private async processRecording(session: RecordingSession): Promise<void> {
    try {
      const outputs: RecordingOutput[] = [];

      // Generate different quality versions
      const qualitiesToGenerate = ['high', 'medium', 'low'];
      
      for (const quality of qualitiesToGenerate) {
        const preset = qualityPresets[quality as keyof typeof qualityPresets];
        const outputPath = join(
          this.tempDir,
          `${session.id}-${quality}.mp4`
        );

        // Transcode using FFmpeg
        await this.transcodeVideo(
          session.tempFilePath,
          outputPath,
          preset
        );

        // Upload to S3
        const s3Key = `recordings/${session.meetingId}/${session.recordingId}/${quality}.mp4`;
        await this.uploadToS3(outputPath, s3Key, 'video/mp4');

        // Get file size
        const stats = await import('fs/promises').then((fs) =>
          fs.stat(outputPath)
        );

        outputs.push({
          quality,
          format: 'mp4',
          resolution: preset.resolution,
          fileSize: stats.size,
          url: s3Key,
        });

        // Clean up temp file
        await unlinkAsync(outputPath);
      }

      // Generate thumbnail
      const thumbnailPath = join(this.tempDir, `${session.id}-thumb.jpg`);
      await this.generateThumbnail(session.tempFilePath, thumbnailPath);
      
      const thumbnailKey = `recordings/${session.meetingId}/${session.recordingId}/thumbnail.jpg`;
      await this.uploadToS3(thumbnailPath, thumbnailKey, 'image/jpeg');
      await unlinkAsync(thumbnailPath);

      // Clean up source file
      await unlinkAsync(session.tempFilePath);

      // Update recording with processed outputs
      const primaryOutput = outputs.find((o) => o.quality === 'high') || outputs[0];
      
      await prisma.recording.update({
        where: { id: session.recordingId },
        data: {
          status: 'AVAILABLE',
          url: primaryOutput.url,
          fileSize: primaryOutput.fileSize,
          thumbnailUrl: thumbnailKey,
          outputs,
          processedAt: new Date(),
        },
      });

      logger.info(`Recording processed: ${session.recordingId}`);

      // Notify about completion
      await safePublish('meeting:events', JSON.stringify({
        type: 'recording.ready',
        meetingId: session.meetingId,
        recordingId: session.recordingId,
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      logger.error('Recording processing failed:', error);

      await prisma.recording.update({
        where: { id: session.recordingId },
        data: {
          status: 'FAILED',
          error: (error as Error).message,
        },
      });

      await safePublish('meeting:events', JSON.stringify({
        type: 'recording.failed',
        meetingId: session.meetingId,
        recordingId: session.recordingId,
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      }));
    }
  }

  private transcodeVideo(
    inputPath: string,
    outputPath: string,
    preset: { resolution: string; videoBitrate: number; audioBitrate: number }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-i', inputPath,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', `${preset.audioBitrate}k`,
        '-movflags', '+faststart',
      ];

      if (preset.resolution !== 'original') {
        args.push('-vf', `scale=${preset.resolution.replace('x', ':')}`);
      }

      args.push('-b:v', `${preset.videoBitrate}k`);
      args.push(outputPath);

      const ffmpeg = spawn('ffmpeg', args);

      ffmpeg.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg exited with code ${code}`));
      });

      ffmpeg.on('error', reject);

      ffmpeg.stderr.on('data', (data) => {
        logger.debug(`FFmpeg: ${data}`);
      });
    });
  }

  private generateThumbnail(
    inputPath: string,
    outputPath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-ss', '00:00:05',
        '-vframes', '1',
        '-vf', 'scale=640:-1',
        '-q:v', '2',
        outputPath,
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg thumbnail failed with code ${code}`));
      });

      ffmpeg.on('error', reject);
    });
  }

  // ============================================================================
  // RETRIEVAL
  // ============================================================================

  async getRecording(recordingId: string): Promise<any> {
    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      include: {
        meeting: true,
        starter: true,
      },
    });

    if (!recording) {
      throw new AppError('Recording not found', 404);
    }

    return recording;
  }

  async getRecordingsByMeeting(meetingId: string): Promise<any[]> {
    return prisma.recording.findMany({
      where: { meetingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRecordingsByOrganization(
    organizationId: string,
    options: {
      status?: string;
      from?: Date;
      to?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ recordings: any[]; total: number }> {
    const where: any = {
      meeting: { organizationId },
    };

    if (options.status) where.status = options.status;
    if (options.from) where.createdAt = { gte: options.from };
    if (options.to) {
      where.createdAt = { ...where.createdAt, lte: options.to };
    }

    const [recordings, total] = await Promise.all([
      prisma.recording.findMany({
        where,
        include: { meeting: true },
        orderBy: { createdAt: 'desc' },
        take: options.limit || 50,
        skip: options.offset || 0,
      }),
      prisma.recording.count({ where }),
    ]);

    return { recordings, total };
  }

  async getPlaybackUrl(
    recordingId: string,
    quality: string = 'high'
  ): Promise<{ url: string; expiresAt: Date }> {
    const recording = await this.getRecording(recordingId);

    if (recording.status !== 'AVAILABLE') {
      throw new AppError('Recording not yet available', 400);
    }

    const outputs = recording.outputs as RecordingOutput[];
    const output = outputs?.find((o) => o.quality === quality) || outputs?.[0];

    if (!output) {
      throw new AppError('Requested quality not available', 404);
    }

    const url = await this.getPresignedUrl(output.url, 3600 * 4); // 4 hours

    return {
      url,
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
    };
  }

  // ============================================================================
  // MANAGEMENT
  // ============================================================================

  async deleteRecording(recordingId: string): Promise<void> {
    const recording = await this.getRecording(recordingId);

    // Delete from S3
    const outputs = recording.outputs as RecordingOutput[];
    for (const output of outputs || []) {
      await this.deleteFromS3(output.url);
    }

    if (recording.thumbnailUrl) {
      await this.deleteFromS3(recording.thumbnailUrl);
    }

    // Delete database record
    await prisma.recording.delete({
      where: { id: recordingId },
    });

    logger.info(`Recording deleted: ${recordingId}`);
  }

  async updateRecordingRetention(
    organizationId: string,
    retentionDays: number
  ): Promise<void> {
    // Update organization settings
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        settings: {
          recordingRetentionDays: retentionDays,
        },
      },
    });
  }

  async cleanupExpiredRecordings(): Promise<number> {
    // Get organizations with retention policies
    const organizations = await prisma.organization.findMany({
      select: { id: true, settings: true },
    });

    let deletedCount = 0;

    for (const org of organizations) {
      const settings = org.settings as any;
      const retentionDays = settings?.recordingRetentionDays || 90;
      const cutoffDate = new Date(
        Date.now() - retentionDays * 24 * 60 * 60 * 1000
      );

      const expiredRecordings = await prisma.recording.findMany({
        where: {
          meeting: { organizationId: org.id },
          createdAt: { lt: cutoffDate },
        },
      });

      for (const recording of expiredRecordings) {
        await this.deleteRecording(recording.id);
        deletedCount++;
      }
    }

    logger.info(`Cleaned up ${deletedCount} expired recordings`);
    return deletedCount;
  }

  // ============================================================================
  // SHARING
  // ============================================================================

  async shareRecording(
    recordingId: string,
    options: {
      expiresIn?: number; // hours
      password?: string;
      allowDownload?: boolean;
      notifyEmails?: string[];
    }
  ): Promise<{ shareUrl: string; shareId: string }> {
    const recording = await this.getRecording(recordingId);

    const shareId = randomUUID();
    const expiresAt = options.expiresIn
      ? new Date(Date.now() + options.expiresIn * 60 * 60 * 1000)
      : null;

    await prisma.recordingShare.create({
      data: {
        id: shareId,
        recordingId,
        expiresAt,
        password: options.password,
        allowDownload: options.allowDownload ?? true,
      },
    });

    const shareUrl = `${config.appUrl}/recordings/shared/${shareId}`;

    // Send email notifications if provided
    if (options.notifyEmails?.length) {
      await safePublish('email:queue', JSON.stringify({
        type: 'recording.shared',
        shareUrl,
        recordingId,
        meetingTitle: recording.meeting.title,
        recipients: options.notifyEmails,
        expiresAt,
        timestamp: new Date().toISOString(),
      }));
    }

    return { shareUrl, shareId };
  }

  async validateShareAccess(
    shareId: string,
    password?: string
  ): Promise<{ recording: any; allowDownload: boolean }> {
    const share = await prisma.recordingShare.findUnique({
      where: { id: shareId },
      include: {
        recording: {
          include: { meeting: true },
        },
      },
    });

    if (!share) {
      throw new AppError('Share link not found', 404);
    }

    if (share.expiresAt && share.expiresAt < new Date()) {
      throw new AppError('Share link has expired', 410);
    }

    if (share.password && share.password !== password) {
      throw new AppError('Invalid password', 401);
    }

    // Increment view count
    await prisma.recordingShare.update({
      where: { id: shareId },
      data: { viewCount: { increment: 1 } },
    });

    return {
      recording: share.recording,
      allowDownload: share.allowDownload,
    };
  }

  // ============================================================================
  // S3 OPERATIONS
  // ============================================================================

  private async uploadToS3(
    filePath: string,
    key: string,
    contentType: string
  ): Promise<void> {
    const stream = createReadStream(filePath);

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: stream,
        ContentType: contentType,
      })
    );
  }

  private async getPresignedUrl(
    key: string,
    expiresIn: number
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  private async deleteFromS3(key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }

  // ============================================================================
  // ANALYTICS
  // ============================================================================

  async getRecordingAnalytics(recordingId: string): Promise<any> {
    const recording = await this.getRecording(recordingId);

    const shares = await prisma.recordingShare.findMany({
      where: { recordingId },
      select: { viewCount: true, createdAt: true },
    });

    const totalViews = shares.reduce((sum: number, s: { viewCount: number }) => sum + s.viewCount, 0);

    return {
      recordingId,
      duration: recording.duration,
      fileSize: recording.fileSize,
      createdAt: recording.createdAt,
      totalShares: shares.length,
      totalViews,
      status: recording.status,
    };
  }
}
