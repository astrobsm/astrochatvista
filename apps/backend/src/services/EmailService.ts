// ============================================================================
// CHATVISTA - Email Service
// Email delivery using various providers
// ============================================================================

import { config } from '../config';
import { logger } from '../utils/logger';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  public provider: 'smtp' | 'sendgrid' | 'ses' = 'smtp';
  public from: string;

  constructor() {
    this.from = (config as any).emailFrom || 'noreply@chatvista.com';
  }

  // ============================================================================
  // EMAIL SENDING
  // ============================================================================

  async send(options: EmailOptions): Promise<void> {
    try {
      // For now, log the email (in production, use actual email provider)
      logger.info('Email sent', {
        to: options.to,
        from: options.from || this.from,
        subject: options.subject,
        provider: this.provider,
      });

      // In production, implement actual email sending:
      // await this.sendViaSMTP(options);
      // or
      // await this.sendViaSendGrid(options);
    } catch (error) {
      logger.error('Email send failed:', error);
      throw error;
    }
  }

  async sendBulk(emails: EmailOptions[]): Promise<void> {
    await Promise.all(emails.map((email) => this.send(email)));
  }

  // ============================================================================
  // TEMPLATES
  // ============================================================================

  getWelcomeTemplate(data: { name: string; verificationUrl: string }): EmailTemplate {
    return {
      subject: 'Welcome to ChatVista - Verify Your Email',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #6366f1; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; }
            .button { display: inline-block; background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; }
            .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to ChatVista</h1>
            </div>
            <div class="content">
              <h2>Hello ${data.name}!</h2>
              <p>Thank you for joining ChatVista. To get started, please verify your email address by clicking the button below:</p>
              <p style="text-align: center;">
                <a href="${data.verificationUrl}" class="button">Verify Email</a>
              </p>
              <p>Or copy and paste this link: ${data.verificationUrl}</p>
              <p>This link will expire in 24 hours.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} ChatVista. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Welcome to ChatVista, ${data.name}!
        
        Please verify your email by visiting: ${data.verificationUrl}
        
        This link will expire in 24 hours.
      `,
    };
  }

  getPasswordResetTemplate(data: { name: string; resetUrl: string }): EmailTemplate {
    return {
      subject: 'ChatVista - Password Reset Request',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #6366f1; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; }
            .button { display: inline-block; background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; }
            .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset</h1>
            </div>
            <div class="content">
              <h2>Hello ${data.name},</h2>
              <p>We received a request to reset your password. Click the button below to create a new password:</p>
              <p style="text-align: center;">
                <a href="${data.resetUrl}" class="button">Reset Password</a>
              </p>
              <p>Or copy and paste this link: ${data.resetUrl}</p>
              <p>This link will expire in 1 hour.</p>
              <p>If you didn't request a password reset, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} ChatVista. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Hello ${data.name},
        
        We received a request to reset your password.
        Visit this link to create a new password: ${data.resetUrl}
        
        This link will expire in 1 hour.
        If you didn't request a password reset, please ignore this email.
      `,
    };
  }

  getMeetingInviteTemplate(data: {
    hostName: string;
    meetingTitle: string;
    meetingDate: string;
    meetingTime: string;
    joinUrl: string;
    agenda?: string;
  }): EmailTemplate {
    return {
      subject: `Meeting Invitation: ${data.meetingTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #6366f1; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; }
            .meeting-info { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .button { display: inline-block; background: #10b981; color: white; padding: 14px 40px; text-decoration: none; border-radius: 5px; font-size: 16px; }
            .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📅 Meeting Invitation</h1>
            </div>
            <div class="content">
              <p><strong>${data.hostName}</strong> has invited you to a meeting.</p>
              
              <div class="meeting-info">
                <h2 style="margin-top: 0;">${data.meetingTitle}</h2>
                <p>📆 <strong>Date:</strong> ${data.meetingDate}</p>
                <p>🕐 <strong>Time:</strong> ${data.meetingTime}</p>
                ${data.agenda ? `<p>📋 <strong>Agenda:</strong><br>${data.agenda}</p>` : ''}
              </div>
              
              <p style="text-align: center;">
                <a href="${data.joinUrl}" class="button">Join Meeting</a>
              </p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} ChatVista. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        ${data.hostName} has invited you to a meeting.
        
        ${data.meetingTitle}
        Date: ${data.meetingDate}
        Time: ${data.meetingTime}
        ${data.agenda ? `Agenda: ${data.agenda}` : ''}
        
        Join: ${data.joinUrl}
      `,
    };
  }

  getMeetingMinutesTemplate(data: {
    meetingTitle: string;
    meetingDate: string;
    summary: string;
    actionItems: Array<{ description: string; assignee?: string }>;
    viewUrl: string;
  }): EmailTemplate {
    const actionItemsHtml = data.actionItems
      .map((item) => `<li>${item.description}${item.assignee ? ` - <strong>${item.assignee}</strong>` : ''}</li>`)
      .join('');

    return {
      subject: `Meeting Minutes: ${data.meetingTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #6366f1; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; }
            .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .action-items { background: #fff7ed; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; }
            .button { display: inline-block; background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; }
            .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📝 Meeting Minutes</h1>
            </div>
            <div class="content">
              <h2>${data.meetingTitle}</h2>
              <p><strong>Date:</strong> ${data.meetingDate}</p>
              
              <div class="summary">
                <h3>Summary</h3>
                <p>${data.summary}</p>
              </div>
              
              ${data.actionItems.length > 0 ? `
              <div class="action-items">
                <h3>⚡ Action Items</h3>
                <ul>${actionItemsHtml}</ul>
              </div>
              ` : ''}
              
              <p style="text-align: center; margin-top: 30px;">
                <a href="${data.viewUrl}" class="button">View Full Minutes</a>
              </p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} ChatVista. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Meeting Minutes: ${data.meetingTitle}
        Date: ${data.meetingDate}
        
        Summary:
        ${data.summary}
        
        Action Items:
        ${data.actionItems.map((item) => `- ${item.description}${item.assignee ? ` (${item.assignee})` : ''}`).join('\n')}
        
        View full minutes: ${data.viewUrl}
      `,
    };
  }

  getRecordingReadyTemplate(data: {
    meetingTitle: string;
    meetingDate: string;
    duration: string;
    viewUrl: string;
  }): EmailTemplate {
    return {
      subject: `Recording Ready: ${data.meetingTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #6366f1; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; }
            .info-box { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; }
            .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎥 Recording Ready</h1>
            </div>
            <div class="content">
              <p>Your meeting recording is now ready to view!</p>
              
              <div class="info-box">
                <h2 style="margin-top: 0;">${data.meetingTitle}</h2>
                <p>📆 <strong>Date:</strong> ${data.meetingDate}</p>
                <p>⏱️ <strong>Duration:</strong> ${data.duration}</p>
              </div>
              
              <p style="text-align: center;">
                <a href="${data.viewUrl}" class="button">Watch Recording</a>
              </p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} ChatVista. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Recording Ready: ${data.meetingTitle}
        Date: ${data.meetingDate}
        Duration: ${data.duration}
        
        Watch: ${data.viewUrl}
      `,
    };
  }

  // ============================================================================
  // CONVENIENCE METHODS
  // ============================================================================

  async sendWelcomeEmail(to: string, name: string, verificationUrl: string): Promise<void> {
    const template = this.getWelcomeTemplate({ name, verificationUrl });
    await this.send({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  async sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<void> {
    const template = this.getPasswordResetTemplate({ name, resetUrl });
    await this.send({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  async sendMeetingInvite(
    to: string[],
    hostName: string,
    meetingTitle: string,
    meetingDate: string,
    meetingTime: string,
    joinUrl: string,
    agenda?: string
  ): Promise<void> {
    const template = this.getMeetingInviteTemplate({
      hostName,
      meetingTitle,
      meetingDate,
      meetingTime,
      joinUrl,
      agenda,
    });

    await this.sendBulk(
      to.map((email) => ({
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      }))
    );
  }

  async sendVerificationEmail(to: string, name: string, verificationToken: string): Promise<void> {
    const verificationUrl = `${(config as any).app?.frontendUrl || config.appUrl}/verify-email?token=${verificationToken}`;
    await this.sendWelcomeEmail(to, name, verificationUrl);
  }
}
