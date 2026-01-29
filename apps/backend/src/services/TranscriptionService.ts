// ============================================================================
// CHATVISTA - Real-Time Transcription Service
// Speech-to-Text with Speaker Diarization
// ============================================================================

import OpenAI from 'openai';
import { prisma } from '../lib/prisma';
import { safePublish } from '../lib/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { EventEmitter } from 'events';

interface TranscriptionSegment {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
  language: string;
  words: TranscriptionWord[];
}

interface TranscriptionWord {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

interface SpeakerProfile {
  id: string;
  name: string;
  color: string;
  totalSpeakingTime: number;
  segmentCount: number;
}

interface TranscriptionSession {
  meetingId: string;
  transcriptId: string;
  language: string;
  speakers: Map<string, SpeakerProfile>;
  segments: TranscriptionSegment[];
  isActive: boolean;
  startTime: number;
}

export class TranscriptionService extends EventEmitter {
  private openai: OpenAI;
  private sessions: Map<string, TranscriptionSession> = new Map();
  private speakerColors = [
    '#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#84cc16', '#ef4444', '#3b82f6', '#10b981',
  ];

  constructor() {
    super();
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  async startTranscription(
    meetingId: string,
    language: string = 'en-US',
    _options: {
      enableDiarization?: boolean;
      maxSpeakers?: number;
      vocabularyHints?: string[];
      enableTranslation?: boolean;
      translationLanguages?: string[];
    } = {}
  ): Promise<{ transcriptId: string; sessionId: string }> {
    // Check if already transcribing
    if (this.sessions.has(meetingId)) {
      const session = this.sessions.get(meetingId)!;
      return {
        transcriptId: session.transcriptId,
        sessionId: meetingId,
      };
    }

    // Create transcript record
    const transcript = await prisma.transcript.create({
      data: {
        meetingId,
        language,
        status: 'RECORDING',
        processingEngine: 'openai-whisper',
      },
    });

    // Initialize session
    const session: TranscriptionSession = {
      meetingId,
      transcriptId: transcript.id,
      language,
      speakers: new Map(),
      segments: [],
      isActive: true,
      startTime: Date.now(),
    };

    this.sessions.set(meetingId, session);

    logger.info(`Transcription started for meeting ${meetingId}`);

    // Publish event
    await safePublish('meeting:events', JSON.stringify({
      type: 'transcription.started',
      meetingId,
      transcriptId: transcript.id,
      timestamp: new Date().toISOString(),
    }));

    return {
      transcriptId: transcript.id,
      sessionId: meetingId,
    };
  }

  async stopTranscription(meetingId: string): Promise<void> {
    const session = this.sessions.get(meetingId);
    if (!session) return;

    session.isActive = false;

    // Finalize transcript
    await prisma.transcript.update({
      where: { id: session.transcriptId },
      data: {
        status: 'PROCESSING',
        duration: Math.round((Date.now() - session.startTime) / 1000),
        wordCount: session.segments.reduce(
          (sum, seg) => sum + seg.text.split(' ').length,
          0
        ),
      },
    });

    // Process and save final segments
    await this.finalizeTranscript(session);

    this.sessions.delete(meetingId);

    logger.info(`Transcription stopped for meeting ${meetingId}`);

    // Publish event
    await safePublish('meeting:events', JSON.stringify({
      type: 'transcription.stopped',
      meetingId,
      transcriptId: session.transcriptId,
      timestamp: new Date().toISOString(),
    }));
  }

  // ============================================================================
  // AUDIO PROCESSING
  // ============================================================================

  async processAudioChunk(
    meetingId: string,
    audioData: Buffer,
    speakerId: string,
    speakerName: string,
    timestamp: number
  ): Promise<TranscriptionSegment | null> {
    const session = this.sessions.get(meetingId);
    if (!session || !session.isActive) {
      return null;
    }

    try {
      // Transcribe using OpenAI Whisper
      const transcription = await this.transcribeAudio(
        audioData,
        session.language
      );

      if (!transcription || !transcription.text.trim()) {
        return null;
      }

      // Get or create speaker profile
      const speaker = this.getOrCreateSpeaker(session, speakerId, speakerName);

      // Create segment
      const segment: TranscriptionSegment = {
        id: `seg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        speakerId,
        speakerName: speaker.name,
        text: transcription.text,
        startTime: timestamp,
        endTime: timestamp + (transcription.duration || 0) * 1000,
        confidence: transcription.confidence || 0.95,
        language: session.language,
        words: transcription.words || [],
      };

      // Update speaker stats
      speaker.totalSpeakingTime += segment.endTime - segment.startTime;
      speaker.segmentCount++;

      // Store segment
      session.segments.push(segment);

      // Save to database
      await this.saveSegment(session.transcriptId, segment, speaker);

      // Emit real-time event
      this.emit('segment', { meetingId, segment });

      // Publish to Redis for other servers
      await safePublish('meeting:events', JSON.stringify({
        type: 'transcription.segment',
        meetingId,
        segment,
        timestamp: new Date().toISOString(),
      }));

      return segment;
    } catch (error) {
      logger.error('Error processing audio chunk:', error);
      return null;
    }
  }

  private async transcribeAudio(
    audioData: Buffer,
    language: string
  ): Promise<{
    text: string;
    confidence?: number;
    duration?: number;
    words?: TranscriptionWord[];
  }> {
    try {
      // Convert buffer to file-like object for OpenAI
      const file = new File([audioData], 'audio.webm', { type: 'audio/webm' });

      const response = await this.openai.audio.transcriptions.create({
        file,
        model: config.openaiWhisperModel,
        language: language.split('-')[0], // 'en-US' -> 'en'
        response_format: 'verbose_json',
        timestamp_granularities: ['word'],
      });

      return {
        text: response.text,
        duration: response.duration,
        words: (response as any).words?.map((w: any) => ({
          word: w.word,
          startTime: w.start * 1000,
          endTime: w.end * 1000,
          confidence: 0.95,
        })),
      };
    } catch (error) {
      logger.error('Whisper transcription error:', error);
      throw error;
    }
  }

  // ============================================================================
  // SPEAKER DIARIZATION
  // ============================================================================

  private getOrCreateSpeaker(
    session: TranscriptionSession,
    speakerId: string,
    speakerName: string
  ): SpeakerProfile {
    if (session.speakers.has(speakerId)) {
      return session.speakers.get(speakerId)!;
    }

    const colorIndex = session.speakers.size % this.speakerColors.length;
    const speaker: SpeakerProfile = {
      id: speakerId,
      name: speakerName,
      color: this.speakerColors[colorIndex],
      totalSpeakingTime: 0,
      segmentCount: 0,
    };

    session.speakers.set(speakerId, speaker);
    return speaker;
  }

  // ============================================================================
  // TRANSLATION
  // ============================================================================

  async translateSegment(
    segment: TranscriptionSegment,
    targetLanguage: string
  ): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following text to ${targetLanguage}. Maintain the original meaning and tone. Only output the translation, nothing else.`,
          },
          {
            role: 'user',
            content: segment.text,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      return response.choices[0]?.message?.content || segment.text;
    } catch (error) {
      logger.error('Translation error:', error);
      return segment.text;
    }
  }

  async translateTranscript(
    transcriptId: string,
    targetLanguage: string
  ): Promise<void> {
    const transcript = await prisma.transcript.findUnique({
      where: { id: transcriptId },
      include: { segments: true },
    });

    if (!transcript) {
      throw new AppError('Transcript not found', 404);
    }

    for (const segment of transcript.segments) {
      const translatedText = await this.translateSegment(
        {
          id: segment.id,
          speakerId: segment.speakerId,
          speakerName: '',
          text: segment.text,
          startTime: segment.startTime,
          endTime: segment.endTime,
          confidence: segment.confidence,
          language: segment.language,
          words: [],
        },
        targetLanguage
      );

      await prisma.transcriptSegment.update({
        where: { id: segment.id },
        data: {
          translation: {
            language: targetLanguage,
            text: translatedText,
            translatedAt: new Date(),
          },
        },
      });
    }
  }

  // ============================================================================
  // DATABASE OPERATIONS
  // ============================================================================

  private async saveSegment(
    transcriptId: string,
    segment: TranscriptionSegment,
    speaker: SpeakerProfile
  ): Promise<void> {
    // Ensure speaker profile exists
    await prisma.speakerProfile.upsert({
      where: { id: speaker.id },
      create: {
        id: speaker.id,
        transcriptId,
        name: speaker.name,
        color: speaker.color,
        totalSpeakingTime: speaker.totalSpeakingTime,
        segmentCount: speaker.segmentCount,
      },
      update: {
        totalSpeakingTime: speaker.totalSpeakingTime,
        segmentCount: speaker.segmentCount,
      },
    });

    // Save segment
    await prisma.transcriptSegment.create({
      data: {
        id: segment.id,
        transcriptId,
        speakerId: speaker.id,
        text: segment.text,
        startTime: segment.startTime,
        endTime: segment.endTime,
        confidence: segment.confidence,
        language: segment.language,
        words: segment.words,
      },
    });
  }

  private async finalizeTranscript(session: TranscriptionSession): Promise<void> {
    // Calculate average confidence
    const avgConfidence =
      session.segments.length > 0
        ? session.segments.reduce((sum, s) => sum + s.confidence, 0) /
          session.segments.length
        : 0;

    // Update transcript status
    await prisma.transcript.update({
      where: { id: session.transcriptId },
      data: {
        status: 'COMPLETED',
        accuracy: avgConfidence,
        finalizedAt: new Date(),
      },
    });

    logger.info(
      `Transcript ${session.transcriptId} finalized with ${session.segments.length} segments`
    );
  }

  // ============================================================================
  // RETRIEVAL
  // ============================================================================

  async getTranscript(transcriptId: string): Promise<any> {
    const transcript = await prisma.transcript.findUnique({
      where: { id: transcriptId },
      include: {
        segments: {
          orderBy: { startTime: 'asc' },
          include: { speaker: true },
        },
        speakers: true,
      },
    });

    if (!transcript) {
      throw new AppError('Transcript not found', 404);
    }

    return transcript;
  }

  async getTranscriptByMeeting(meetingId: string): Promise<any[]> {
    return prisma.transcript.findMany({
      where: { meetingId },
      include: {
        segments: {
          orderBy: { startTime: 'asc' },
        },
        speakers: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async searchTranscripts(
    organizationId: string,
    query: string,
    options: {
      meetingId?: string;
      speakerId?: string;
      from?: Date;
      to?: Date;
      limit?: number;
    } = {}
  ): Promise<any[]> {
    const where: any = {
      meeting: { organizationId },
    };

    if (options.meetingId) {
      where.meetingId = options.meetingId;
    }

    const segments = await prisma.transcriptSegment.findMany({
      where: {
        ...where,
        text: { contains: query, mode: 'insensitive' },
        ...(options.speakerId && { speakerId: options.speakerId }),
      },
      include: {
        speaker: true,
        transcript: {
          include: { meeting: true },
        },
      },
      take: options.limit || 50,
      orderBy: { createdAt: 'desc' },
    });

    return segments;
  }

  // ============================================================================
  // EDITING
  // ============================================================================

  async editSegment(
    segmentId: string,
    newText: string,
    editedBy: string
  ): Promise<void> {
    await prisma.transcriptSegment.update({
      where: { id: segmentId },
      data: {
        text: newText,
        isEdited: true,
        editedBy,
        editedAt: new Date(),
      },
    });

    // Update transcript status
    const segment = await prisma.transcriptSegment.findUnique({
      where: { id: segmentId },
      select: { transcriptId: true },
    });

    if (segment) {
      await prisma.transcript.update({
        where: { id: segment.transcriptId },
        data: { status: 'EDITING' },
      });
    }
  }

  async updateSpeakerName(speakerId: string, newName: string): Promise<void> {
    await prisma.speakerProfile.update({
      where: { id: speakerId },
      data: { name: newName },
    });
  }

  // ============================================================================
  // EXPORT
  // ============================================================================

  async exportTranscript(
    transcriptId: string,
    format: 'txt' | 'srt' | 'vtt' | 'json'
  ): Promise<string> {
    const transcript = await this.getTranscript(transcriptId);

    switch (format) {
      case 'txt':
        return this.exportAsText(transcript);
      case 'srt':
        return this.exportAsSRT(transcript);
      case 'vtt':
        return this.exportAsVTT(transcript);
      case 'json':
        return JSON.stringify(transcript, null, 2);
      default:
        throw new AppError('Invalid format', 400);
    }
  }

  private exportAsText(transcript: any): string {
    let output = '';

    for (const segment of transcript.segments) {
      const timestamp = this.formatTimestamp(segment.startTime);
      output += `[${timestamp}] ${segment.speaker.name}: ${segment.text}\n\n`;
    }

    return output;
  }

  private exportAsSRT(transcript: any): string {
    let output = '';
    let index = 1;

    for (const segment of transcript.segments) {
      const startTime = this.formatSRTTime(segment.startTime);
      const endTime = this.formatSRTTime(segment.endTime);

      output += `${index}\n`;
      output += `${startTime} --> ${endTime}\n`;
      output += `${segment.speaker.name}: ${segment.text}\n\n`;
      index++;
    }

    return output;
  }

  private exportAsVTT(transcript: any): string {
    let output = 'WEBVTT\n\n';

    for (const segment of transcript.segments) {
      const startTime = this.formatVTTTime(segment.startTime);
      const endTime = this.formatVTTTime(segment.endTime);

      output += `${startTime} --> ${endTime}\n`;
      output += `<v ${segment.speaker.name}>${segment.text}\n\n`;
    }

    return output;
  }

  private formatTimestamp(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    const h = hours.toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');

    return `${h}:${m}:${s}`;
  }

  private formatSRTTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const milliseconds = ms % 1000;

    const h = hours.toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    const ms_str = milliseconds.toString().padStart(3, '0');

    return `${h}:${m}:${s},${ms_str}`;
  }

  private formatVTTTime(ms: number): string {
    return this.formatSRTTime(ms).replace(',', '.');
  }
}
