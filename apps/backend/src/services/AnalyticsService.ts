// ============================================================================
// CHATVISTA - Analytics Service
// Meeting analytics, usage tracking, and reporting
// ============================================================================

import { prisma } from '../lib/prisma';

interface DateRange {
  from: Date;
  to: Date;
}

interface MeetingStats {
  totalMeetings: number;
  totalDuration: number;
  averageDuration: number;
  totalParticipants: number;
  averageParticipants: number;
  peakConcurrentMeetings: number;
}

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  engagementRate: number;
}

interface EngagementStats {
  totalChatMessages: number;
  totalReactions: number;
  totalScreenShares: number;
  totalRecordings: number;
  totalTranscriptions: number;
}

export class AnalyticsService {
  // ============================================================================
  // ORGANIZATION ANALYTICS
  // ============================================================================

  async getOrganizationDashboard(
    organizationId: string,
    dateRange?: DateRange
  ): Promise<{
    meetings: MeetingStats;
    users: UserStats;
    engagement: EngagementStats;
    trends: any;
  }> {
    const range = dateRange || this.getDefaultDateRange();

    const [meetings, users, engagement, trends] = await Promise.all([
      this.getMeetingStats(organizationId, range),
      this.getUserStats(organizationId, range),
      this.getEngagementStats(organizationId, range),
      this.getTrends(organizationId, range),
    ]);

    return { meetings, users, engagement, trends };
  }

  async getMeetingStats(
    organizationId: string,
    range: DateRange
  ): Promise<MeetingStats> {
    const meetings = await prisma.meeting.findMany({
      where: {
        organizationId,
        scheduledStart: { gte: range.from, lte: range.to },
        status: { not: 'CANCELLED' },
      },
      include: {
        _count: { select: { participants: true } },
      },
    });

    const completedMeetings = meetings.filter((m: any) => m.status === 'ENDED');
    
    const totalDuration = completedMeetings.reduce((sum: number, m: any) => {
      if (m.actualEnd && m.actualStart) {
        return sum + (m.actualEnd.getTime() - m.actualStart.getTime()) / 60000;
      }
      return sum;
    }, 0);

    const totalParticipants = meetings.reduce(
      (sum: number, m: any) => sum + m._count.participants,
      0
    );

    return {
      totalMeetings: meetings.length,
      totalDuration: Math.round(totalDuration),
      averageDuration: completedMeetings.length
        ? Math.round(totalDuration / completedMeetings.length)
        : 0,
      totalParticipants,
      averageParticipants: meetings.length
        ? Math.round(totalParticipants / meetings.length)
        : 0,
      peakConcurrentMeetings: await this.getPeakConcurrentMeetings(
        organizationId,
        range
      ),
    };
  }

  async getUserStats(
    organizationId: string,
    range: DateRange
  ): Promise<UserStats> {
    const [totalUsers, activeUsers, newUsers] = await Promise.all([
      prisma.user.count({ where: { organizationId } }),
      prisma.user.count({
        where: {
          organizationId,
          lastLogin: { gte: range.from },
        },
      }),
      prisma.user.count({
        where: {
          organizationId,
          createdAt: { gte: range.from, lte: range.to },
        },
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      newUsers,
      engagementRate: totalUsers ? (activeUsers / totalUsers) * 100 : 0,
    };
  }

  async getEngagementStats(
    organizationId: string,
    range: DateRange
  ): Promise<EngagementStats> {
    const meetingIds = await prisma.meeting.findMany({
      where: {
        organizationId,
        scheduledStart: { gte: range.from, lte: range.to },
      },
      select: { id: true },
    }).then((meetings: any[]) => meetings.map((m: any) => m.id));

    const [chatMessages, recordings, transcriptions] = await Promise.all([
      prisma.chatMessage.count({
        where: { meetingId: { in: meetingIds } },
      }),
      prisma.recording.count({
        where: { meetingId: { in: meetingIds } },
      }),
      prisma.transcript.count({
        where: { meetingId: { in: meetingIds } },
      }),
    ]);

    return {
      totalChatMessages: chatMessages,
      totalReactions: 0, // Would need to aggregate from chat messages
      totalScreenShares: 0, // Would need separate tracking
      totalRecordings: recordings,
      totalTranscriptions: transcriptions,
    };
  }

  async getTrends(organizationId: string, range: DateRange): Promise<any> {
    // Group meetings by day
    const meetings = await prisma.meeting.findMany({
      where: {
        organizationId,
        scheduledStart: { gte: range.from, lte: range.to },
      },
      select: {
        scheduledStart: true,
        _count: { select: { participants: true } },
      },
    });

    // Aggregate by date
    const dailyStats = new Map<string, { meetings: number; participants: number }>();

    for (const meeting of meetings) {
      const date = meeting.scheduledStart.toISOString().split('T')[0];
      const current = dailyStats.get(date) || { meetings: 0, participants: 0 };
      dailyStats.set(date, {
        meetings: current.meetings + 1,
        participants: current.participants + meeting._count.participants,
      });
    }

    return Array.from(dailyStats.entries()).map(([date, stats]) => ({
      date,
      ...stats,
    }));
  }

  private async getPeakConcurrentMeetings(
    organizationId: string,
    range: DateRange
  ): Promise<number> {
    // This is a simplified version - real implementation would need
    // to analyze overlapping time ranges
    const meetings = await prisma.meeting.findMany({
      where: {
        organizationId,
        scheduledStart: { gte: range.from, lte: range.to },
        status: 'ENDED',
      },
      select: {
        actualStart: true,
        actualEnd: true,
      },
    });

    // Simple peak calculation
    let maxConcurrent = 0;
    const events: { time: Date; delta: number }[] = [];

    for (const meeting of meetings) {
      if (meeting.actualStart && meeting.actualEnd) {
        events.push({ time: meeting.actualStart, delta: 1 });
        events.push({ time: meeting.actualEnd, delta: -1 });
      }
    }

    events.sort((a, b) => a.time.getTime() - b.time.getTime());

    let current = 0;
    for (const event of events) {
      current += event.delta;
      maxConcurrent = Math.max(maxConcurrent, current);
    }

    return maxConcurrent;
  }

  // ============================================================================
  // MEETING ANALYTICS
  // ============================================================================

  async getMeetingAnalytics(meetingId: string): Promise<any> {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        participants: {
          include: { user: true },
        },
        chatMessages: true,
        recordings: true,
        transcripts: {
          include: { speakers: true },
        },
      },
    });

    if (!meeting) {
      throw new Error('Meeting not found');
    }

    const duration = meeting.actualEnd && meeting.actualStart
      ? Math.round((meeting.actualEnd.getTime() - meeting.actualStart.getTime()) / 60000)
      : 0;

    const speakerStats = meeting.transcripts[0]?.speakers.map((s: any) => ({
      id: s.id,
      name: s.name,
      speakingTime: s.totalSpeakingTime,
      segmentCount: s.segmentCount,
      percentage: duration
        ? Math.round((s.totalSpeakingTime / (duration * 60000)) * 100)
        : 0,
    })) || [];

    return {
      meetingId,
      title: meeting.title,
      duration,
      participantCount: meeting.participants.length,
      participants: meeting.participants.map((p: any) => ({
        id: p.userId,
        name: p.user.name,
        role: p.role,
        joinedAt: p.joinedAt,
        leftAt: p.leftAt,
      })),
      engagement: {
        chatMessages: meeting.chatMessages.length,
        recordings: meeting.recordings.length,
        transcriptions: meeting.transcripts.length,
      },
      speakerStats,
    };
  }

  // ============================================================================
  // USER ANALYTICS
  // ============================================================================

  async getUserAnalytics(
    userId: string,
    range?: DateRange
  ): Promise<any> {
    const dateRange = range || this.getDefaultDateRange();

    const participations = await prisma.participant.findMany({
      where: {
        userId,
        meeting: {
          scheduledStart: { gte: dateRange.from, lte: dateRange.to },
        },
      },
      include: {
        meeting: true,
      },
    });

    const hostedMeetings = participations.filter((p: any) => p.role === 'HOST').length;
    const attendedMeetings = participations.length - hostedMeetings;

    const totalMeetingTime = participations.reduce((sum: number, p: any) => {
      if (p.leftAt && p.joinedAt) {
        return sum + (p.leftAt.getTime() - p.joinedAt.getTime());
      }
      return sum;
    }, 0);

    const actionItems = await prisma.actionItem.findMany({
      where: {
        assigneeId: userId,
        createdAt: { gte: dateRange.from, lte: dateRange.to },
      },
    });

    const completedActionItems = actionItems.filter(
      (a: any) => a.status === 'COMPLETED'
    ).length;

    return {
      userId,
      period: dateRange,
      meetings: {
        total: participations.length,
        hosted: hostedMeetings,
        attended: attendedMeetings,
        totalMinutes: Math.round(totalMeetingTime / 60000),
      },
      actionItems: {
        total: actionItems.length,
        completed: completedActionItems,
        completionRate: actionItems.length
          ? (completedActionItems / actionItems.length) * 100
          : 0,
      },
    };
  }

  // ============================================================================
  // REPORT GENERATION
  // ============================================================================

  async generateReport(
    organizationId: string,
    reportType: 'weekly' | 'monthly' | 'quarterly' | 'custom',
    options: {
      from?: Date;
      to?: Date;
      includeUserBreakdown?: boolean;
      includeDepartmentBreakdown?: boolean;
    } = {}
  ): Promise<any> {
    const range = this.getDateRangeForReportType(reportType, options);

    const [dashboard, topMeetings, topUsers] = await Promise.all([
      this.getOrganizationDashboard(organizationId, range),
      this.getTopMeetings(organizationId, range, 10),
      this.getTopUsers(organizationId, range, 10),
    ]);

    let userBreakdown = null;
    let departmentBreakdown = null;

    if (options.includeUserBreakdown) {
      userBreakdown = await this.getUserBreakdown(organizationId, range);
    }

    if (options.includeDepartmentBreakdown) {
      departmentBreakdown = await this.getDepartmentBreakdown(organizationId, range);
    }

    return {
      reportType,
      period: range,
      generatedAt: new Date(),
      summary: dashboard,
      topMeetings,
      topUsers,
      userBreakdown,
      departmentBreakdown,
    };
  }

  private async getTopMeetings(
    organizationId: string,
    range: DateRange,
    limit: number
  ): Promise<any[]> {
    return prisma.meeting.findMany({
      where: {
        organizationId,
        scheduledStart: { gte: range.from, lte: range.to },
        status: 'ENDED',
      },
      include: {
        _count: { select: { participants: true } },
      },
      orderBy: { participants: { _count: 'desc' } },
      take: limit,
    });
  }

  private async getTopUsers(
    organizationId: string,
    range: DateRange,
    limit: number
  ): Promise<any[]> {
    const users = await prisma.user.findMany({
      where: { organizationId },
      include: {
        participations: {
          where: {
            meeting: {
              scheduledStart: { gte: range.from, lte: range.to },
            },
          },
        },
      },
    });

    return users
      .map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        meetingsAttended: u.participations.length,
      }))
      .sort((a: any, b: any) => b.meetingsAttended - a.meetingsAttended)
      .slice(0, limit);
  }

  private async getUserBreakdown(
    organizationId: string,
    range: DateRange
  ): Promise<any[]> {
    const users = await prisma.user.findMany({
      where: { organizationId },
      include: {
        participations: {
          where: {
            meeting: {
              scheduledStart: { gte: range.from, lte: range.to },
            },
          },
          include: { meeting: true },
        },
      },
    });

    return users.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      department: (u as any).departmentId,
      meetings: u.participations.length,
      hostedMeetings: u.participations.filter((p: any) => p.role === 'HOST').length,
    }));
  }

  private async getDepartmentBreakdown(
    organizationId: string,
    range: DateRange
  ): Promise<any[]> {
    const departments = await prisma.department.findMany({
      where: { organizationId },
      include: {
        members: {
          include: {
            participations: {
              where: {
                meeting: {
                  scheduledStart: { gte: range.from, lte: range.to },
                },
              },
            },
          },
        },
      },
    });

    return departments.map((d: any) => ({
      id: d.id,
      name: d.name,
      memberCount: d.members.length,
      totalMeetings: d.members.reduce(
        (sum: number, m: any) => sum + m.participations.length,
        0
      ),
    }));
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private getDefaultDateRange(): DateRange {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days
    return { from, to };
  }

  private getDateRangeForReportType(
    type: string,
    options: { from?: Date; to?: Date }
  ): DateRange {
    if (type === 'custom' && options.from && options.to) {
      return { from: options.from, to: options.to };
    }

    const to = new Date();
    let from: Date;

    switch (type) {
      case 'weekly':
        from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarterly':
        from = new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { from, to };
  }
}
