// ============================================================================
// CHATVISTA - AI Meeting Minutes Generation Service
// Intelligent meeting summarization and action item extraction
// ============================================================================

import OpenAI from 'openai';
import { prisma } from '../lib/prisma';
import { safePublish } from '../lib/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

interface MinutesSection {
  title: string;
  content: string;
  startTime?: number;
  endTime?: number;
}

interface ActionItem {
  id: string;
  description: string;
  assignee?: string;
  assigneeId?: string;
  dueDate?: Date;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  extractedFrom?: string;
}

interface Decision {
  id: string;
  description: string;
  context: string;
  participants: string[];
  timestamp: number;
  confidence: number;
}

interface KeyPoint {
  id: string;
  content: string;
  speaker: string;
  timestamp: number;
  importance: number;
}

interface AgendaItem {
  id: string;
  title: string;
  discussed: boolean;
  duration: number;
  outcomes: string[];
}

interface MeetingMinutesData {
  meetingId: string;
  title: string;
  summary: string;
  executiveSummary: string;
  sections: MinutesSection[];
  actionItems: ActionItem[];
  decisions: Decision[];
  keyPoints: KeyPoint[];
  agenda: AgendaItem[];
  participants: {
    id: string;
    name: string;
    role: string;
    speakingTime: number;
    contributions: number;
  }[];
  sentiment: {
    overall: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'MIXED';
    score: number;
    breakdown: {
      positive: number;
      neutral: number;
      negative: number;
    };
  };
  topics: {
    name: string;
    relevance: number;
    duration: number;
  }[];
  followUps: string[];
  generatedAt: Date;
}

export class MinutesService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }

  // ============================================================================
  // MINUTES GENERATION
  // ============================================================================

  async generateMinutes(
    meetingId: string,
    options: {
      includeTranscript?: boolean;
      detailLevel?: 'brief' | 'standard' | 'detailed';
      templateId?: string;
      language?: string;
    } = {}
  ): Promise<MeetingMinutesData> {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        participants: {
          include: { user: true },
        },
        transcripts: {
          include: {
            segments: {
              include: { speaker: true },
              orderBy: { startTime: 'asc' },
            },
          },
        },
        chatMessages: true,
      },
    });

    if (!meeting) {
      throw new AppError('Meeting not found', 404);
    }

    // Get the latest transcript
    const transcript = meeting.transcripts[0];
    if (!transcript || transcript.segments.length === 0) {
      throw new AppError('No transcript available for this meeting', 400);
    }

    // Prepare transcript text for AI processing
    const transcriptText = transcript.segments
      .map((s: { speaker: { name: string }; text: string }) => `[${s.speaker.name}]: ${s.text}`)
      .join('\n');

    // Generate minutes using AI
    const minutesData = await this.processWithAI(
      meeting,
      transcriptText,
      options
    );

    // Save to database
    const minutes = await this.saveMinutes(meetingId, minutesData);

    // Publish event
    await safePublish('meeting:events', JSON.stringify({
      type: 'minutes.generated',
      meetingId,
      minutesId: minutes.id,
      timestamp: new Date().toISOString(),
    }));

    logger.info(`Minutes generated for meeting ${meetingId}`);

    return minutesData;
  }

  private async processWithAI(
    meeting: any,
    transcriptText: string,
    options: { detailLevel?: string; language?: string }
  ): Promise<MeetingMinutesData> {
    const detailPrompt =
      options.detailLevel === 'brief'
        ? 'Be concise and focus on the most important points.'
        : options.detailLevel === 'detailed'
        ? 'Provide comprehensive details and context.'
        : 'Provide a balanced summary with key details.';

    const systemPrompt = `You are an expert meeting analyst and executive assistant. Your task is to analyze meeting transcripts and generate comprehensive, professional meeting minutes.

${detailPrompt}

You must extract:
1. Executive Summary: 2-3 sentences summarizing the meeting's purpose and outcome
2. Key Discussion Points: Main topics discussed with context
3. Decisions Made: Clear decisions with context and participants involved
4. Action Items: Tasks with assignees, due dates (if mentioned), and priority levels
5. Follow-up Items: Topics to revisit in future meetings
6. Sentiment Analysis: Overall tone and engagement of the meeting

Output your response as valid JSON with the following structure:
{
  "executiveSummary": "string",
  "summary": "string (detailed summary)",
  "sections": [{"title": "string", "content": "string"}],
  "actionItems": [{"description": "string", "assignee": "string or null", "dueDate": "ISO date or null", "priority": "HIGH|MEDIUM|LOW"}],
  "decisions": [{"description": "string", "context": "string", "participants": ["string"]}],
  "keyPoints": [{"content": "string", "speaker": "string", "importance": 1-10}],
  "topics": [{"name": "string", "relevance": 0-1}],
  "followUps": ["string"],
  "sentiment": {"overall": "POSITIVE|NEUTRAL|NEGATIVE|MIXED", "score": 0-1}
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Meeting Title: ${meeting.title}
Meeting Date: ${meeting.scheduledStart}
Participants: ${meeting.participants.map((p: any) => p.user.name).join(', ')}

TRANSCRIPT:
${transcriptText}

Please analyze this meeting transcript and generate comprehensive meeting minutes.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      const aiResult = JSON.parse(content);

      // Structure the final minutes data
      return {
        meetingId: meeting.id,
        title: meeting.title,
        summary: aiResult.summary || '',
        executiveSummary: aiResult.executiveSummary || '',
        sections: aiResult.sections || [],
        actionItems: (aiResult.actionItems || []).map((item: any, idx: number) => ({
          id: `action-${idx}`,
          description: item.description,
          assignee: item.assignee,
          dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
          priority: item.priority || 'MEDIUM',
          status: 'PENDING',
        })),
        decisions: (aiResult.decisions || []).map((d: any, idx: number) => ({
          id: `decision-${idx}`,
          description: d.description,
          context: d.context || '',
          participants: d.participants || [],
          timestamp: Date.now(),
          confidence: 0.9,
        })),
        keyPoints: (aiResult.keyPoints || []).map((k: any, idx: number) => ({
          id: `keypoint-${idx}`,
          content: k.content,
          speaker: k.speaker || 'Unknown',
          timestamp: Date.now(),
          importance: k.importance || 5,
        })),
        agenda: [],
        participants: meeting.participants.map((p: any) => ({
          id: p.userId,
          name: p.user.name,
          role: p.role,
          speakingTime: 0,
          contributions: 0,
        })),
        sentiment: aiResult.sentiment || {
          overall: 'NEUTRAL',
          score: 0.5,
          breakdown: { positive: 33, neutral: 34, negative: 33 },
        },
        topics: aiResult.topics || [],
        followUps: aiResult.followUps || [],
        generatedAt: new Date(),
      };
    } catch (error) {
      logger.error('AI processing error:', error);
      throw new AppError('Failed to generate meeting minutes', 500);
    }
  }

  // ============================================================================
  // DATABASE OPERATIONS
  // ============================================================================

  private async saveMinutes(
    meetingId: string,
    data: MeetingMinutesData
  ): Promise<any> {
    // Create minutes record
    const minutes = await prisma.meetingMinutes.create({
      data: {
        meetingId,
        title: data.title,
        summary: data.summary,
        executiveSummary: data.executiveSummary,
        sections: data.sections,
        keyPoints: data.keyPoints,
        topics: data.topics,
        sentiment: data.sentiment,
        followUps: data.followUps,
        status: 'DRAFT',
        version: 1,
      },
    });

    // Create action items
    for (const item of data.actionItems) {
      await prisma.actionItem.create({
        data: {
          minutesId: minutes.id,
          description: item.description,
          assigneeName: item.assignee,
          assigneeId: item.assigneeId,
          dueDate: item.dueDate,
          priority: item.priority,
          status: item.status,
        },
      });
    }

    // Create decisions
    for (const decision of data.decisions) {
      await prisma.decision.create({
        data: {
          minutesId: minutes.id,
          description: decision.description,
          context: decision.context,
          participants: decision.participants,
          confidence: decision.confidence,
        },
      });
    }

    return minutes;
  }

  async getMinutes(minutesId: string): Promise<any> {
    const minutes = await prisma.meetingMinutes.findUnique({
      where: { id: minutesId },
      include: {
        actionItems: true,
        decisions: true,
        meeting: {
          include: {
            participants: {
              include: { user: true },
            },
          },
        },
      },
    });

    if (!minutes) {
      throw new AppError('Meeting minutes not found', 404);
    }

    return minutes;
  }

  async getMinutesByMeeting(meetingId: string): Promise<any[]> {
    return prisma.meetingMinutes.findMany({
      where: { meetingId },
      include: {
        actionItems: true,
        decisions: true,
      },
      orderBy: { version: 'desc' },
    });
  }

  // ============================================================================
  // ACTION ITEM MANAGEMENT
  // ============================================================================

  async updateActionItem(
    actionItemId: string,
    updates: {
      description?: string;
      assigneeId?: string;
      dueDate?: Date;
      priority?: 'HIGH' | 'MEDIUM' | 'LOW';
      status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    }
  ): Promise<any> {
    return prisma.actionItem.update({
      where: { id: actionItemId },
      data: updates,
    });
  }

  async getActionItemsByUser(userId: string): Promise<any[]> {
    return prisma.actionItem.findMany({
      where: { assigneeId: userId },
      include: {
        minutes: {
          include: {
            meeting: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async getActionItemsByOrganization(
    organizationId: string,
    options: {
      status?: string;
      assigneeId?: string;
      priority?: string;
      dueBefore?: Date;
    } = {}
  ): Promise<any[]> {
    const where: any = {
      minutes: {
        meeting: { organizationId },
      },
    };

    if (options.status) where.status = options.status;
    if (options.assigneeId) where.assigneeId = options.assigneeId;
    if (options.priority) where.priority = options.priority;
    if (options.dueBefore) where.dueDate = { lte: options.dueBefore };

    return prisma.actionItem.findMany({
      where,
      include: {
        assignee: true,
        minutes: {
          include: { meeting: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  // ============================================================================
  // MINUTES EDITING & APPROVAL
  // ============================================================================

  async updateMinutes(
    minutesId: string,
    updates: {
      summary?: string;
      sections?: MinutesSection[];
      keyPoints?: KeyPoint[];
    }
  ): Promise<any> {
    return prisma.meetingMinutes.update({
      where: { id: minutesId },
      data: {
        ...updates,
        status: 'EDITING',
      },
    });
  }

  async approveMinutes(
    minutesId: string,
    approverId: string
  ): Promise<any> {
    const minutes = await prisma.meetingMinutes.update({
      where: { id: minutesId },
      data: {
        status: 'APPROVED',
        approvedBy: approverId,
        approvedAt: new Date(),
      },
    });

    // Notify participants
    await safePublish('meeting:events', JSON.stringify({
      type: 'minutes.approved',
      minutesId,
      meetingId: minutes.meetingId,
      timestamp: new Date().toISOString(),
    }));

    return minutes;
  }

  async publishMinutes(minutesId: string): Promise<any> {
    return prisma.meetingMinutes.update({
      where: { id: minutesId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
  }

  // ============================================================================
  // REGENERATION
  // ============================================================================

  async regenerateSection(
    minutesId: string,
    sectionTitle: string,
    additionalContext?: string
  ): Promise<MinutesSection> {
    const minutes = await this.getMinutes(minutesId);

    const meeting = await prisma.meeting.findUnique({
      where: { id: minutes.meetingId },
      include: {
        transcripts: {
          include: { segments: true },
        },
      },
    });

    if (!meeting?.transcripts[0]) {
      throw new AppError('No transcript available', 400);
    }

    const transcriptText = meeting.transcripts[0].segments
      .map((s: any) => s.text)
      .join(' ');

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are regenerating a specific section of meeting minutes. Section: "${sectionTitle}". ${additionalContext || ''} Output only the new content for this section.`,
        },
        {
          role: 'user',
          content: `Transcript: ${transcriptText.substring(0, 8000)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const newContent = response.choices[0]?.message?.content || '';

    // Update the section in database
    const sections = minutes.sections as MinutesSection[];
    const sectionIndex = sections.findIndex((s) => s.title === sectionTitle);

    if (sectionIndex >= 0) {
      sections[sectionIndex].content = newContent;
    } else {
      sections.push({ title: sectionTitle, content: newContent });
    }

    await prisma.meetingMinutes.update({
      where: { id: minutesId },
      data: { sections },
    });

    return { title: sectionTitle, content: newContent };
  }

  // ============================================================================
  // TEMPLATES
  // ============================================================================

  async createTemplate(
    organizationId: string,
    data: {
      name: string;
      description: string;
      sections: string[];
      includeActionItems: boolean;
      includeDecisions: boolean;
      includeSentiment: boolean;
      customFields: { name: string; type: string }[];
    }
  ): Promise<any> {
    return prisma.minutesTemplate.create({
      data: {
        organizationId,
        name: data.name,
        description: data.description,
        sections: data.sections,
        includeActionItems: data.includeActionItems,
        includeDecisions: data.includeDecisions,
        includeSentiment: data.includeSentiment,
        customFields: data.customFields,
        isDefault: false,
      },
    });
  }

  async getTemplates(organizationId: string): Promise<any[]> {
    return prisma.minutesTemplate.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  // ============================================================================
  // SHARING & DISTRIBUTION
  // ============================================================================

  async shareMinutes(
    minutesId: string,
    options: {
      userIds?: string[];
      emails?: string[];
      message?: string;
      includeRecording?: boolean;
      includeTranscript?: boolean;
    }
  ): Promise<void> {
    const minutes = await this.getMinutes(minutesId);

    // Queue email notifications
    await safePublish('email:queue', JSON.stringify({
      type: 'minutes.share',
      minutesId,
      meetingId: minutes.meetingId,
      recipients: [...(options.userIds || []), ...(options.emails || [])],
      message: options.message,
      includeRecording: options.includeRecording,
      includeTranscript: options.includeTranscript,
      timestamp: new Date().toISOString(),
    }));

    logger.info(`Minutes ${minutesId} shared with ${options.userIds?.length || 0} users and ${options.emails?.length || 0} emails`);
  }
}
