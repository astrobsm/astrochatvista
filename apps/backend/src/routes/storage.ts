// ============================================================================
// CHATVISTA - Storage Routes
// API endpoints for file storage operations
// ============================================================================

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../middleware/auth';
import { storageService, StorageType } from '../services/StorageService';
import { logger } from '../utils/logger';

const router: Router = Router();

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max
  },
  storage: multer.memoryStorage(),
});

// ============================================================================
// File Upload
// ============================================================================

router.post(
  '/:type/upload',
  authenticate,
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const type = req.params.type as StorageType;
      const validTypes = ['recordings', 'transcripts', 'minutes', 'exports', 'avatars'];
      
      if (!validTypes.includes(type)) {
        res.status(400).json({ error: 'Invalid storage type' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      const result = await storageService.saveFile(
        type,
        req.file.originalname,
        req.file.buffer,
        {
          contentType: req.file.mimetype,
          compress: req.body.compress === 'true',
          encrypt: req.body.encrypt === 'true',
          backup: req.body.backup !== 'false',
          metadata: {
            userId: (req as any).user?.id,
            uploadedBy: (req as any).user?.email,
          },
        }
      );

      logger.info('File uploaded via API', { 
        type, 
        filename: req.file.originalname,
        userId: (req as any).user?.id,
      });

      res.json({
        success: true,
        file: result,
      });
    } catch (error) {
      logger.error('File upload failed', { error });
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

// ============================================================================
// File Download
// ============================================================================

router.get(
  '/:type/:fileId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { type, fileId } = req.params;
      const validTypes = ['recordings', 'transcripts', 'minutes', 'exports', 'avatars'];
      
      if (!validTypes.includes(type)) {
        res.status(400).json({ error: 'Invalid storage type' });
        return;
      }

      const data = await storageService.getFile(type as StorageType, fileId);

      // Set content type based on file extension
      const ext = fileId.split('.').pop()?.toLowerCase();
      const contentTypes: Record<string, string> = {
        webm: 'video/webm',
        mp4: 'video/mp4',
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        pdf: 'application/pdf',
        json: 'application/json',
        txt: 'text/plain',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
      };

      res.set('Content-Type', contentTypes[ext || ''] || 'application/octet-stream');
      res.set('Content-Length', String(data.length));
      res.send(data);
    } catch (error) {
      logger.error('File download failed', { error });
      res.status(404).json({ error: 'File not found' });
    }
  }
);

// ============================================================================
// Get Signed URL
// ============================================================================

router.get(
  '/:type/:fileId/url',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { type, fileId } = req.params;
      const expiresIn = parseInt(req.query.expiresIn as string) || 3600;

      const url = await storageService.getFileUrl(
        type as StorageType,
        fileId,
        { expiresIn }
      );

      res.json({ url, expiresIn });
    } catch (error) {
      logger.error('Failed to get file URL', { error });
      res.status(500).json({ error: 'Failed to generate URL' });
    }
  }
);

// ============================================================================
// List Files
// ============================================================================

router.get(
  '/:type',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { type } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await storageService.listFiles(type as StorageType, { limit, offset });

      res.json(result);
    } catch (error) {
      logger.error('Failed to list files', { error });
      res.status(500).json({ error: 'Failed to list files' });
    }
  }
);

// ============================================================================
// Delete File
// ============================================================================

router.delete(
  '/:type/:fileId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { type, fileId } = req.params;

      await storageService.deleteFile(type as StorageType, fileId);

      logger.info('File deleted', { type, fileId, userId: (req as any).user?.id });

      res.json({ success: true });
    } catch (error) {
      logger.error('File deletion failed', { error });
      res.status(500).json({ error: 'Delete failed' });
    }
  }
);

// ============================================================================
// Storage Statistics (Admin only)
// ============================================================================

router.get(
  '/admin/stats',
  authenticate,
  authorize('SUPER_ADMIN', 'ORG_ADMIN'),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const stats = await storageService.getStorageStats();
      res.json(stats);
    } catch (error) {
      logger.error('Failed to get storage stats', { error });
      res.status(500).json({ error: 'Failed to get stats' });
    }
  }
);

// ============================================================================
// Sync Operations (Admin only)
// ============================================================================

router.post(
  '/admin/sync/local-to-cloud',
  authenticate,
  authorize('SUPER_ADMIN'),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await storageService.syncLocalToCloud();
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Sync to cloud failed', { error });
      res.status(500).json({ error: 'Sync failed' });
    }
  }
);

router.post(
  '/admin/sync/cloud-to-local',
  authenticate,
  authorize('SUPER_ADMIN'),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await storageService.syncCloudToLocal();
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Sync to local failed', { error });
      res.status(500).json({ error: 'Sync failed' });
    }
  }
);

router.get(
  '/admin/sync/status',
  authenticate,
  authorize('SUPER_ADMIN', 'ORG_ADMIN'),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const status = await storageService.getSyncStatus();
      res.json(status);
    } catch (error) {
      logger.error('Failed to get sync status', { error });
      res.status(500).json({ error: 'Failed to get status' });
    }
  }
);

// ============================================================================
// Backup Operations (Admin only)
// ============================================================================

router.post(
  '/admin/backup',
  authenticate,
  authorize('SUPER_ADMIN'),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      await storageService.runBackup();
      res.json({ success: true, message: 'Backup initiated' });
    } catch (error) {
      logger.error('Backup failed', { error });
      res.status(500).json({ error: 'Backup failed' });
    }
  }
);

router.post(
  '/admin/cleanup',
  authenticate,
  authorize('SUPER_ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const retentionDays = parseInt(req.body.retentionDays) || 30;
      const result = await storageService.cleanupOldFiles(retentionDays);
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Cleanup failed', { error });
      res.status(500).json({ error: 'Cleanup failed' });
    }
  }
);

export default router;
