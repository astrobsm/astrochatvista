// ============================================================================
// CHATVISTA - Notification Service
// Real-time and push notifications
// ============================================================================

import { prisma } from '../lib/prisma';
import { safePublish } from '../lib/redis';
import { logger } from '../utils/logger';

interface NotificationPayload {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  actionUrl?: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  expiresAt?: Date;
}

interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
  sms: boolean;
  types: {
    meetingReminders: boolean;
    meetingInvites: boolean;
    actionItems: boolean;
    minutesReady: boolean;
    recordingReady: boolean;
    mentions: boolean;
  };
}

export class NotificationService {
  // ============================================================================
  // NOTIFICATION SENDING
  // ============================================================================

  async send(notification: NotificationPayload): Promise<void> {
    try {
      // Get user preferences
      const user = await prisma.user.findUnique({
        where: { id: notification.userId },
        select: { settings: true },
      });

      const preferences = (user?.settings as any)?.notifications as NotificationPreferences || this.getDefaultPreferences();

      // Create database notification
      if (preferences.inApp) {
        await this.createInAppNotification(notification);
      }

      // Send real-time notification via WebSocket
      await this.sendRealtimeNotification(notification);

      // Queue email notification if enabled
      if (preferences.email && this.shouldSendEmail(notification.type, preferences)) {
        await this.queueEmailNotification(notification);
      }

      // Queue push notification if enabled
      if (preferences.push) {
        await this.queuePushNotification(notification);
      }

      logger.info(`Notification sent to user ${notification.userId}: ${notification.type}`);
    } catch (error) {
      logger.error('Notification send error:', error);
    }
  }

  async sendToMultiple(
    userIds: string[],
    notification: Omit<NotificationPayload, 'userId'>
  ): Promise<void> {
    await Promise.all(
      userIds.map((userId) =>
        this.send({ ...notification, userId })
      )
    );
  }

  async sendToOrganization(
    organizationId: string,
    notification: Omit<NotificationPayload, 'userId'>
  ): Promise<void> {
    const users = await prisma.user.findMany({
      where: { organizationId },
      select: { id: true },
    });

    await this.sendToMultiple(
      users.map((u: { id: string }) => u.id),
      notification
    );
  }

  // ============================================================================
  // IN-APP NOTIFICATIONS
  // ============================================================================

  private async createInAppNotification(notification: NotificationPayload): Promise<void> {
    await prisma.notification.create({
      data: {
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data || {},
        actionUrl: notification.actionUrl,
        priority: notification.priority || 'NORMAL',
        expiresAt: notification.expiresAt,
        isRead: false,
      },
    });
  }

  private async sendRealtimeNotification(notification: NotificationPayload): Promise<void> {
    await safePublish('user:notifications', JSON.stringify({
      userId: notification.userId,
      notification: {
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        actionUrl: notification.actionUrl,
        priority: notification.priority,
        timestamp: new Date().toISOString(),
      },
    }));
  }

  // ============================================================================
  // EMAIL NOTIFICATIONS
  // ============================================================================

  private shouldSendEmail(type: string, preferences: NotificationPreferences): boolean {
    const typeMap: Record<string, keyof NotificationPreferences['types']> = {
      'meeting.reminder': 'meetingReminders',
      'meeting.invite': 'meetingInvites',
      'action-item.assigned': 'actionItems',
      'minutes.ready': 'minutesReady',
      'recording.ready': 'recordingReady',
      'mention': 'mentions',
    };

    const prefKey = typeMap[type];
    if (!prefKey) return true; // Default to sending for unknown types
    return preferences.types[prefKey] !== false;
  }

  private async queueEmailNotification(notification: NotificationPayload): Promise<void> {
    await safePublish('email:queue', JSON.stringify({
      type: 'notification',
      userId: notification.userId,
      notificationType: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      actionUrl: notification.actionUrl,
      timestamp: new Date().toISOString(),
    }));
  }

  // ============================================================================
  // PUSH NOTIFICATIONS
  // ============================================================================

  private async queuePushNotification(notification: NotificationPayload): Promise<void> {
    await safePublish('push:queue', JSON.stringify({
      userId: notification.userId,
      title: notification.title,
      body: notification.message,
      data: notification.data,
      actionUrl: notification.actionUrl,
      priority: notification.priority,
      timestamp: new Date().toISOString(),
    }));
  }

  // ============================================================================
  // NOTIFICATION RETRIEVAL
  // ============================================================================

  async getUserNotifications(
    userId: string,
    options: {
      unreadOnly?: boolean;
      type?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ notifications: any[]; total: number; unreadCount: number }> {
    const where: any = { userId };
    if (options.unreadOnly) where.isRead = false;
    if (options.type) where.type = options.type;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options.limit || 50,
        skip: options.offset || 0,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { notifications, total, unreadCount };
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
  }

  async deleteAllNotifications(userId: string): Promise<void> {
    await prisma.notification.deleteMany({
      where: { userId },
    });
  }

  // ============================================================================
  // NOTIFICATION TEMPLATES
  // ============================================================================

  async sendMeetingReminder(
    userId: string,
    meetingId: string,
    meetingTitle: string,
    startsIn: number // minutes
  ): Promise<void> {
    await this.send({
      userId,
      type: 'meeting.reminder',
      title: 'Meeting Starting Soon',
      message: `"${meetingTitle}" starts in ${startsIn} minutes`,
      data: { meetingId },
      actionUrl: `/meeting/${meetingId}`,
      priority: startsIn <= 5 ? 'HIGH' : 'NORMAL',
    });
  }

  async sendMeetingInvite(
    userId: string,
    meetingId: string,
    meetingTitle: string,
    hostName: string
  ): Promise<void> {
    await this.send({
      userId,
      type: 'meeting.invite',
      title: 'Meeting Invitation',
      message: `${hostName} invited you to "${meetingTitle}"`,
      data: { meetingId, hostName },
      actionUrl: `/meeting/${meetingId}`,
      priority: 'NORMAL',
    });
  }

  async sendActionItemAssigned(
    userId: string,
    actionItemId: string,
    description: string,
    meetingTitle: string,
    dueDate?: Date
  ): Promise<void> {
    await this.send({
      userId,
      type: 'action-item.assigned',
      title: 'New Action Item',
      message: `From "${meetingTitle}": ${description}`,
      data: { actionItemId, meetingTitle, dueDate: dueDate?.toISOString() },
      actionUrl: `/action-items/${actionItemId}`,
      priority: 'NORMAL',
    });
  }

  async sendMinutesReady(
    userId: string,
    minutesId: string,
    meetingTitle: string
  ): Promise<void> {
    await this.send({
      userId,
      type: 'minutes.ready',
      title: 'Meeting Minutes Ready',
      message: `Minutes for "${meetingTitle}" are ready for review`,
      data: { minutesId },
      actionUrl: `/minutes/${minutesId}`,
      priority: 'NORMAL',
    });
  }

  async sendRecordingReady(
    userId: string,
    recordingId: string,
    meetingTitle: string
  ): Promise<void> {
    await this.send({
      userId,
      type: 'recording.ready',
      title: 'Recording Ready',
      message: `Recording for "${meetingTitle}" is now available`,
      data: { recordingId },
      actionUrl: `/recordings/${recordingId}`,
      priority: 'LOW',
    });
  }

  async sendMention(
    userId: string,
    mentionedBy: string,
    context: string,
    contextId: string,
    contextType: 'meeting' | 'minutes' | 'chat'
  ): Promise<void> {
    await this.send({
      userId,
      type: 'mention',
      title: 'You were mentioned',
      message: `${mentionedBy} mentioned you: "${context.substring(0, 100)}..."`,
      data: { mentionedBy, contextId, contextType },
      actionUrl: `/${contextType}/${contextId}`,
      priority: 'NORMAL',
    });
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private getDefaultPreferences(): NotificationPreferences {
    return {
      email: true,
      push: true,
      inApp: true,
      sms: false,
      types: {
        meetingReminders: true,
        meetingInvites: true,
        actionItems: true,
        minutesReady: true,
        recordingReady: true,
        mentions: true,
      },
    };
  }
}
