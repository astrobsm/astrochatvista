// ============================================================================
// CHATVISTA - PDF Export Service
// Professional document generation with branding and templates
// ============================================================================

import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';

interface ExportConfig {
  format: 'pdf' | 'docx';
  paperSize: 'A4' | 'LETTER' | 'LEGAL';
  orientation: 'portrait' | 'landscape';
  margins: { top: number; bottom: number; left: number; right: number };
  includeHeader: boolean;
  includeFooter: boolean;
  includeTOC: boolean;
  includePageNumbers: boolean;
  includeTimestamps: boolean;
  includeSpeakerColors: boolean;
  includeConfidentialWatermark: boolean;
  branding: {
    logo?: string;
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
  };
}

const defaultConfig: ExportConfig = {
  format: 'pdf',
  paperSize: 'A4',
  orientation: 'portrait',
  margins: { top: 72, bottom: 72, left: 72, right: 72 },
  includeHeader: true,
  includeFooter: true,
  includeTOC: true,
  includePageNumbers: true,
  includeTimestamps: true,
  includeSpeakerColors: true,
  includeConfidentialWatermark: false,
  branding: {
    primaryColor: '#6366f1',
    secondaryColor: '#1e293b',
    fontFamily: 'Helvetica',
  },
};

export class ExportService {
  private s3Client: S3Client;
  private bucket: string;

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
    this.bucket = (config as any).minioBucket || 'chatvista-exports';
  }

  // ============================================================================
  // MEETING MINUTES EXPORT
  // ============================================================================

  async exportMeetingMinutes(
    minutesId: string,
    configOverrides: Partial<ExportConfig> = {}
  ): Promise<{ url: string; expiresAt: Date }> {
    const minutes = await prisma.meetingMinutes.findUnique({
      where: { id: minutesId },
      include: {
        meeting: {
          include: {
            organization: true,
            participants: {
              include: { user: true },
            },
          },
        },
        actionItems: {
          include: { assignee: true },
        },
        decisions: true,
      },
    });

    if (!minutes) {
      throw new AppError('Meeting minutes not found', 404);
    }

    // Merge config with organization branding
    const exportConfig: ExportConfig = {
      ...defaultConfig,
      ...configOverrides,
      branding: {
        ...defaultConfig.branding,
        ...minutes.meeting.organization.branding,
        ...configOverrides.branding,
      },
    };

    // Generate PDF
    const pdfBuffer = await this.generateMinutesPDF(minutes, exportConfig);

    // Upload to S3
    const fileName = `exports/minutes/${minutesId}-${Date.now()}.pdf`;
    await this.uploadToS3(fileName, pdfBuffer, 'application/pdf');

    // Generate presigned URL
    const url = await this.getPresignedUrl(fileName, 3600 * 24 * 7); // 7 days

    // Save export record
    await prisma.documentExport.create({
      data: {
        type: 'MINUTES',
        sourceId: minutesId,
        format: 'PDF',
        fileName,
        fileSize: pdfBuffer.length,
        checksum: this.calculateChecksum(pdfBuffer),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    logger.info(`Meeting minutes exported: ${minutesId}`);

    return {
      url,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
  }

  private async generateMinutesPDF(
    minutes: any,
    config: ExportConfig
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: config.paperSize,
        layout: config.orientation,
        margins: config.margins,
        bufferPages: true,
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add content
      this.addMinutesContent(doc, minutes, config);

      // Add headers and footers
      if (config.includeHeader || config.includeFooter || config.includePageNumbers) {
        this.addHeadersFooters(doc, minutes, config);
      }

      // Add confidential watermark if needed
      if (config.includeConfidentialWatermark) {
        this.addWatermark(doc, 'CONFIDENTIAL');
      }

      doc.end();
    });
  }

  private addMinutesContent(
    doc: typeof PDFDocument.prototype,
    minutes: any,
    config: ExportConfig
  ): void {
    const { branding } = config;
    const meeting = minutes.meeting;

    // Title Page
    doc.fontSize(28)
       .fillColor(branding.primaryColor)
       .font(`${branding.fontFamily}-Bold`)
       .text('MEETING MINUTES', { align: 'center' });

    doc.moveDown(0.5);

    doc.fontSize(18)
       .fillColor(branding.secondaryColor)
       .font(branding.fontFamily)
       .text(meeting.title, { align: 'center' });

    doc.moveDown(2);

    // Meeting details box
    this.addInfoBox(doc, [
      { label: 'Date', value: new Date(meeting.scheduledStart).toLocaleDateString() },
      { label: 'Time', value: `${new Date(meeting.scheduledStart).toLocaleTimeString()} - ${new Date(meeting.scheduledEnd).toLocaleTimeString()}` },
      { label: 'Organization', value: meeting.organization.name },
      { label: 'Status', value: minutes.status },
    ], branding);

    doc.moveDown(1.5);

    // Participants
    doc.fontSize(14)
       .fillColor(branding.primaryColor)
       .font(`${branding.fontFamily}-Bold`)
       .text('PARTICIPANTS');

    doc.moveDown(0.3);

    const participants = meeting.participants.map((p: any) => 
      `${p.user.name}${p.role === 'HOST' ? ' (Host)' : ''}`
    ).join(', ');

    doc.fontSize(11)
       .fillColor('#374151')
       .font(branding.fontFamily)
       .text(participants);

    doc.moveDown(1.5);

    // Executive Summary
    if (minutes.executiveSummary) {
      doc.fontSize(14)
         .fillColor(branding.primaryColor)
         .font(`${branding.fontFamily}-Bold`)
         .text('EXECUTIVE SUMMARY');

      doc.moveDown(0.3);

      doc.fontSize(11)
         .fillColor('#374151')
         .font(branding.fontFamily)
         .text(minutes.executiveSummary, {
           align: 'justify',
           lineGap: 2,
         });

      doc.moveDown(1.5);
    }

    // Summary
    if (minutes.summary) {
      doc.fontSize(14)
         .fillColor(branding.primaryColor)
         .font(`${branding.fontFamily}-Bold`)
         .text('MEETING SUMMARY');

      doc.moveDown(0.3);

      doc.fontSize(11)
         .fillColor('#374151')
         .font(branding.fontFamily)
         .text(minutes.summary, {
           align: 'justify',
           lineGap: 2,
         });

      doc.moveDown(1.5);
    }

    // Sections
    const sections = minutes.sections as any[];
    for (const section of sections || []) {
      doc.fontSize(14)
         .fillColor(branding.primaryColor)
         .font(`${branding.fontFamily}-Bold`)
         .text(section.title.toUpperCase());

      doc.moveDown(0.3);

      doc.fontSize(11)
         .fillColor('#374151')
         .font(branding.fontFamily)
         .text(section.content, {
           align: 'justify',
           lineGap: 2,
         });

      doc.moveDown(1);
    }

    // Decisions
    if (minutes.decisions && minutes.decisions.length > 0) {
      doc.addPage();

      doc.fontSize(16)
         .fillColor(branding.primaryColor)
         .font(`${branding.fontFamily}-Bold`)
         .text('DECISIONS');

      doc.moveDown(0.5);

      for (let i = 0; i < minutes.decisions.length; i++) {
        const decision = minutes.decisions[i];
        
        doc.fontSize(12)
           .fillColor(branding.secondaryColor)
           .font(`${branding.fontFamily}-Bold`)
           .text(`${i + 1}. ${decision.description}`);

        if (decision.context) {
          doc.fontSize(10)
             .fillColor('#6b7280')
             .font(branding.fontFamily)
             .text(`Context: ${decision.context}`, { indent: 20 });
        }

        if (decision.participants && decision.participants.length > 0) {
          doc.fontSize(10)
             .fillColor('#6b7280')
             .text(`Involved: ${decision.participants.join(', ')}`, { indent: 20 });
        }

        doc.moveDown(0.5);
      }

      doc.moveDown(1);
    }

    // Action Items
    if (minutes.actionItems && minutes.actionItems.length > 0) {
      doc.fontSize(16)
         .fillColor(branding.primaryColor)
         .font(`${branding.fontFamily}-Bold`)
         .text('ACTION ITEMS');

      doc.moveDown(0.5);

      // Action items table
      this.addActionItemsTable(doc, minutes.actionItems, branding);

      doc.moveDown(1);
    }

    // Key Points
    const keyPoints = minutes.keyPoints as any[];
    if (keyPoints && keyPoints.length > 0) {
      doc.addPage();

      doc.fontSize(16)
         .fillColor(branding.primaryColor)
         .font(`${branding.fontFamily}-Bold`)
         .text('KEY DISCUSSION POINTS');

      doc.moveDown(0.5);

      for (const point of keyPoints) {
        doc.fontSize(11)
           .fillColor('#374151')
           .font(branding.fontFamily)
           .list([`${point.speaker}: ${point.content}`], {
             bulletRadius: 3,
             bulletIndent: 10,
             textIndent: 20,
           });

        doc.moveDown(0.3);
      }

      doc.moveDown(1);
    }

    // Follow-ups
    const followUps = minutes.followUps as string[];
    if (followUps && followUps.length > 0) {
      doc.fontSize(14)
         .fillColor(branding.primaryColor)
         .font(`${branding.fontFamily}-Bold`)
         .text('FOLLOW-UP ITEMS');

      doc.moveDown(0.3);

      doc.fontSize(11)
         .fillColor('#374151')
         .font(branding.fontFamily)
         .list(followUps, {
           bulletRadius: 3,
           bulletIndent: 10,
           textIndent: 20,
         });
    }

    // Footer with generation info
    doc.moveDown(2);
    doc.fontSize(9)
       .fillColor('#9ca3af')
       .text(`Generated on ${new Date().toLocaleString()} by ChatVista`, {
         align: 'center',
       });
  }

  private addInfoBox(
    doc: typeof PDFDocument.prototype,
    items: { label: string; value: string }[],
    branding: ExportConfig['branding']
  ): void {
    const startY = doc.y;
    const boxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    
    // Draw box background
    doc.rect(doc.x, startY, boxWidth, items.length * 22 + 20)
       .fill('#f8fafc');

    // Draw border
    doc.rect(doc.x, startY, boxWidth, items.length * 22 + 20)
       .stroke(branding.primaryColor);

    doc.y = startY + 10;

    for (const item of items) {
      doc.fontSize(10)
         .fillColor('#6b7280')
         .font('Helvetica')
         .text(`${item.label}: `, doc.x + 10, doc.y, { continued: true })
         .fillColor('#1f2937')
         .font('Helvetica-Bold')
         .text(item.value);

      doc.moveDown(0.3);
    }

    doc.y = startY + items.length * 22 + 30;
  }

  private addActionItemsTable(
    doc: typeof PDFDocument.prototype,
    actionItems: any[],
    branding: ExportConfig['branding']
  ): void {
    const tableTop = doc.y;
    const colWidths = [40, 200, 100, 80, 60];
    const headers = ['#', 'Description', 'Assignee', 'Due Date', 'Priority'];

    // Draw header row
    let x = doc.x;
    doc.rect(x, tableTop, colWidths.reduce((a, b) => a + b, 0), 25)
       .fill(branding.primaryColor);

    x = doc.x;
    for (let i = 0; i < headers.length; i++) {
      doc.fontSize(10)
         .fillColor('#ffffff')
         .font('Helvetica-Bold')
         .text(headers[i], x + 5, tableTop + 7, {
           width: colWidths[i] - 10,
           align: 'left',
         });
      x += colWidths[i];
    }

    // Draw data rows
    let y = tableTop + 25;
    for (let i = 0; i < actionItems.length; i++) {
      const item = actionItems[i];
      const rowColor = i % 2 === 0 ? '#ffffff' : '#f9fafb';

      x = doc.x;
      doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), 30)
         .fill(rowColor);

      // Row content
      doc.fontSize(9).fillColor('#374151').font('Helvetica');

      // Number
      doc.text((i + 1).toString(), x + 5, y + 10, { width: colWidths[0] - 10 });
      x += colWidths[0];

      // Description
      doc.text(item.description.substring(0, 60), x + 5, y + 5, {
        width: colWidths[1] - 10,
        height: 25,
        ellipsis: true,
      });
      x += colWidths[1];

      // Assignee
      doc.text(item.assigneeName || item.assignee?.name || 'Unassigned', x + 5, y + 10, {
        width: colWidths[2] - 10,
      });
      x += colWidths[2];

      // Due Date
      doc.text(
        item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'N/A',
        x + 5,
        y + 10,
        { width: colWidths[3] - 10 }
      );
      x += colWidths[3];

      // Priority
      const priorityColors: Record<string, string> = {
        HIGH: '#ef4444',
        MEDIUM: '#f59e0b',
        LOW: '#10b981',
      };
      doc.fillColor(priorityColors[item.priority] || '#6b7280')
         .text(item.priority, x + 5, y + 10, { width: colWidths[4] - 10 });

      y += 30;
    }

    doc.y = y + 10;
  }

  private addHeadersFooters(
    doc: typeof PDFDocument.prototype,
    minutes: any,
    config: ExportConfig
  ): void {
    const pages = doc.bufferedPageRange();

    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);

      // Header
      if (config.includeHeader && i > 0) {
        const headerY = 30;
        doc.fontSize(9)
           .fillColor('#6b7280')
           .font('Helvetica')
           .text(minutes.meeting.title, doc.page.margins.left, headerY, {
             width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
             align: 'left',
           });

        doc.text(
          minutes.meeting.organization.name,
          doc.page.margins.left,
          headerY,
          {
            width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
            align: 'right',
          }
        );

        // Header line
        doc.moveTo(doc.page.margins.left, headerY + 15)
           .lineTo(doc.page.width - doc.page.margins.right, headerY + 15)
           .stroke('#e5e7eb');
      }

      // Footer with page numbers
      if (config.includePageNumbers) {
        const footerY = doc.page.height - 40;
        doc.fontSize(9)
           .fillColor('#6b7280')
           .text(
             `Page ${i + 1} of ${pages.count}`,
             doc.page.margins.left,
             footerY,
             {
               width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
               align: 'center',
             }
           );
      }
    }
  }

  private addWatermark(doc: typeof PDFDocument.prototype, text: string): void {
    const pages = doc.bufferedPageRange();

    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);

      // Save state
      doc.save();

      // Center of page
      const cx = doc.page.width / 2;
      const cy = doc.page.height / 2;

      // Rotate and add watermark
      doc.translate(cx, cy)
         .rotate(-45)
         .fontSize(60)
         .fillColor('#e5e7eb')
         .opacity(0.3)
         .text(text, -150, -30, { width: 300, align: 'center' });

      // Restore state
      doc.restore();
    }
  }

  // ============================================================================
  // TRANSCRIPT EXPORT
  // ============================================================================

  async exportTranscript(
    transcriptId: string,
    configOverrides: Partial<ExportConfig> = {}
  ): Promise<{ url: string; expiresAt: Date }> {
    const transcript = await prisma.transcript.findUnique({
      where: { id: transcriptId },
      include: {
        meeting: {
          include: { organization: true },
        },
        segments: {
          include: { speaker: true },
          orderBy: { startTime: 'asc' },
        },
        speakers: true,
      },
    });

    if (!transcript) {
      throw new AppError('Transcript not found', 404);
    }

    const exportConfig: ExportConfig = {
      ...defaultConfig,
      ...configOverrides,
    };

    const pdfBuffer = await this.generateTranscriptPDF(transcript, exportConfig);

    const fileName = `exports/transcripts/${transcriptId}-${Date.now()}.pdf`;
    await this.uploadToS3(fileName, pdfBuffer, 'application/pdf');

    const url = await this.getPresignedUrl(fileName, 3600 * 24 * 7);

    await prisma.documentExport.create({
      data: {
        type: 'TRANSCRIPT',
        sourceId: transcriptId,
        format: 'PDF',
        fileName,
        fileSize: pdfBuffer.length,
        checksum: this.calculateChecksum(pdfBuffer),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      url,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
  }

  private async generateTranscriptPDF(
    transcript: any,
    config: ExportConfig
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: config.paperSize,
        layout: config.orientation,
        margins: config.margins,
        bufferPages: true,
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { branding } = config;

      // Title
      doc.fontSize(24)
         .fillColor(branding.primaryColor)
         .font(`${branding.fontFamily}-Bold`)
         .text('MEETING TRANSCRIPT', { align: 'center' });

      doc.moveDown(0.5);

      doc.fontSize(14)
         .fillColor(branding.secondaryColor)
         .font(branding.fontFamily)
         .text(transcript.meeting.title, { align: 'center' });

      doc.moveDown(1);

      doc.fontSize(10)
         .fillColor('#6b7280')
         .text(`Date: ${new Date(transcript.meeting.scheduledStart).toLocaleDateString()}`);
      doc.text(`Duration: ${Math.round(transcript.duration / 60)} minutes`);
      doc.text(`Word Count: ${transcript.wordCount}`);

      doc.moveDown(1.5);

      // Speaker legend
      if (config.includeSpeakerColors && transcript.speakers.length > 0) {
        doc.fontSize(12)
           .fillColor(branding.primaryColor)
           .font(`${branding.fontFamily}-Bold`)
           .text('SPEAKERS');

        doc.moveDown(0.3);

        for (const speaker of transcript.speakers) {
          doc.circle(doc.x + 5, doc.y + 5, 5)
             .fill(speaker.color);
          
          doc.fontSize(10)
             .fillColor('#374151')
             .font(branding.fontFamily)
             .text(`  ${speaker.name}`, doc.x + 15, doc.y - 2);
          
          doc.moveDown(0.3);
        }

        doc.moveDown(1);
      }

      // Transcript content
      doc.fontSize(14)
         .fillColor(branding.primaryColor)
         .font(`${branding.fontFamily}-Bold`)
         .text('TRANSCRIPT');

      doc.moveDown(0.5);

      for (const segment of transcript.segments) {
        // Timestamp
        if (config.includeTimestamps) {
          const timestamp = this.formatTimestamp(segment.startTime);
          doc.fontSize(8)
             .fillColor('#9ca3af')
             .text(timestamp);
        }

        // Speaker name
        doc.fontSize(10)
           .fillColor(config.includeSpeakerColors ? segment.speaker.color : '#374151')
           .font(`${branding.fontFamily}-Bold`)
           .text(`${segment.speaker.name}:`, { continued: true })
           .font(branding.fontFamily)
           .fillColor('#374151')
           .text(` ${segment.text}`);

        doc.moveDown(0.5);
      }

      // Add headers/footers
      if (config.includeHeader || config.includeFooter || config.includePageNumbers) {
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);
          if (config.includePageNumbers) {
            doc.fontSize(9)
               .fillColor('#6b7280')
               .text(
                 `Page ${i + 1} of ${pages.count}`,
                 doc.page.margins.left,
                 doc.page.height - 40,
                 {
                   width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
                   align: 'center',
                 }
               );
          }
        }
      }

      doc.end();
    });
  }

  private formatTimestamp(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  }

  // ============================================================================
  // S3 OPERATIONS
  // ============================================================================

  private async uploadToS3(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<void> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
  }

  private async getPresignedUrl(key: string, expiresIn: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  private calculateChecksum(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  // ============================================================================
  // BATCH EXPORT
  // ============================================================================

  async batchExport(
    _meetingIds: string[],
    _exportType: 'minutes' | 'transcript' | 'both',
    _config?: Partial<ExportConfig>
  ): Promise<{ url: string; expiresAt: Date }> {
    // This would create a ZIP file with all exports
    // For now, return a placeholder
    throw new AppError('Batch export not yet implemented', 501);
  }
}
