// ============================================================================
// CHATVISTA - Local Storage Service
// Device storage with robust backup plan for recordings, transcripts, and data
// ============================================================================

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { createGzip, createGunzip } from 'zlib';
import { logger } from '../utils/logger';
import { config } from '../config';

void pipeline; // Keep for potential future use
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);
const copyFile = promisify(fs.copyFile);
const rename = promisify(fs.rename);

// ============================================================================
// Types
// ============================================================================

export interface StorageOptions {
  compress?: boolean;
  encrypt?: boolean;
  backup?: boolean;
  retentionDays?: number;
}

export interface StoredFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  checksum: string;
  createdAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface BackupInfo {
  id: string;
  sourceFile: string;
  backupPath: string;
  createdAt: Date;
  size: number;
  checksum: string;
}

// ============================================================================
// Configuration
// ============================================================================

const STORAGE_BASE_PATH = process.env.CHATVISTA_STORAGE_PATH || 
  path.join(process.cwd(), 'chatvista-storage');

const STORAGE_DIRS = {
  recordings: path.join(STORAGE_BASE_PATH, 'recordings'),
  transcripts: path.join(STORAGE_BASE_PATH, 'transcripts'),
  minutes: path.join(STORAGE_BASE_PATH, 'minutes'),
  exports: path.join(STORAGE_BASE_PATH, 'exports'),
  avatars: path.join(STORAGE_BASE_PATH, 'avatars'),
  temp: path.join(STORAGE_BASE_PATH, 'temp'),
  backup: path.join(STORAGE_BASE_PATH, 'backup'),
  archive: path.join(STORAGE_BASE_PATH, 'archive'),
};

// ============================================================================
// Local Storage Service
// ============================================================================

export class LocalStorageService {
  private initialized = false;
  private encryptionKey: Buffer;

  constructor() {
    // Derive encryption key from config
    this.encryptionKey = crypto.scryptSync(
      config.encryptionKey || 'default-encryption-key-change-me',
      'chatvista-salt',
      32
    );
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Create all storage directories
      for (const dir of Object.values(STORAGE_DIRS)) {
        await mkdir(dir, { recursive: true });
      }

      // Create subdirectories for organization
      const subDirs = ['daily', 'weekly', 'monthly'];
      for (const subDir of subDirs) {
        await mkdir(path.join(STORAGE_DIRS.backup, subDir), { recursive: true });
      }

      this.initialized = true;
      logger.info('Local storage service initialized', { basePath: STORAGE_BASE_PATH });
    } catch (error) {
      logger.error('Failed to initialize local storage', { error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // File Storage Operations
  // --------------------------------------------------------------------------

  async saveFile(
    type: keyof typeof STORAGE_DIRS,
    filename: string,
    data: Buffer | NodeJS.ReadableStream,
    options: StorageOptions = {}
  ): Promise<StoredFile> {
    await this.initialize();

    const { compress = false, encrypt = false, backup = true, retentionDays } = options;
    
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString().split('T')[0];
    const safeFilename = this.sanitizeFilename(filename);
    const finalFilename = `${timestamp}_${id}_${safeFilename}`;
    
    let targetPath = path.join(STORAGE_DIRS[type], finalFilename);
    
    // Add extensions based on processing
    if (compress) targetPath += '.gz';
    if (encrypt) targetPath += '.enc';

    try {
      let processedData: Buffer;
      
      if (Buffer.isBuffer(data)) {
        processedData = data;
      } else {
        // Read stream to buffer
        const chunks: Buffer[] = [];
        for await (const chunk of data) {
          chunks.push(Buffer.from(chunk));
        }
        processedData = Buffer.concat(chunks);
      }

      // Compress if requested
      if (compress) {
        processedData = await this.compressData(processedData);
      }

      // Encrypt if requested
      if (encrypt) {
        processedData = this.encryptData(processedData);
      }

      // Calculate checksum
      const checksum = this.calculateChecksum(processedData);

      // Write file
      await writeFile(targetPath, processedData);

      const storedFile: StoredFile = {
        id,
        filename: finalFilename,
        originalName: filename,
        mimeType: this.getMimeType(filename),
        size: processedData.length,
        path: targetPath,
        checksum,
        createdAt: new Date(),
        expiresAt: retentionDays 
          ? new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000)
          : undefined,
      };

      // Create backup if requested
      if (backup) {
        await this.createBackup(storedFile);
      }

      // Save metadata
      await this.saveMetadata(storedFile);

      logger.info('File saved to local storage', { 
        id, 
        type, 
        filename: finalFilename,
        size: processedData.length,
        compressed: compress,
        encrypted: encrypt,
      });

      return storedFile;
    } catch (error) {
      logger.error('Failed to save file', { error, type, filename });
      throw error;
    }
  }

  async getFile(
    type: keyof typeof STORAGE_DIRS,
    fileId: string,
    options: { decompress?: boolean; decrypt?: boolean } = {}
  ): Promise<Buffer> {
    await this.initialize();

    const { decompress = false, decrypt = false } = options;

    try {
      // Find the file
      const files = await readdir(STORAGE_DIRS[type]);
      const file = files.find(f => f.includes(fileId));
      
      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }

      const filePath = path.join(STORAGE_DIRS[type], file);
      let data: Buffer = await readFile(filePath);

      // Decrypt if needed
      if (decrypt || file.endsWith('.enc')) {
        data = this.decryptData(data) as Buffer;
      }

      // Decompress if needed
      if (decompress || file.endsWith('.gz') || file.endsWith('.gz.enc')) {
        data = await this.decompressData(data) as Buffer;
      }

      return data;
    } catch (error) {
      logger.error('Failed to get file', { error, type, fileId });
      throw error;
    }
  }

  async deleteFile(type: keyof typeof STORAGE_DIRS, fileId: string): Promise<void> {
    await this.initialize();

    try {
      const files = await readdir(STORAGE_DIRS[type]);
      const file = files.find(f => f.includes(fileId));
      
      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }

      const filePath = path.join(STORAGE_DIRS[type], file);
      
      // Move to archive instead of deleting (soft delete)
      const archivePath = path.join(STORAGE_DIRS.archive, type, file);
      await mkdir(path.dirname(archivePath), { recursive: true });
      await rename(filePath, archivePath);

      // Delete metadata
      const metadataPath = filePath + '.meta.json';
      if (fs.existsSync(metadataPath)) {
        await unlink(metadataPath);
      }

      logger.info('File archived', { type, fileId, archivePath });
    } catch (error) {
      logger.error('Failed to delete file', { error, type, fileId });
      throw error;
    }
  }

  async listFiles(
    type: keyof typeof STORAGE_DIRS,
    options: { limit?: number; offset?: number; search?: string } = {}
  ): Promise<StoredFile[]> {
    await this.initialize();

    const { limit = 100, offset = 0, search } = options;

    try {
      const files = await readdir(STORAGE_DIRS[type]);
      let filteredFiles = files.filter(f => !f.endsWith('.meta.json'));

      if (search) {
        filteredFiles = filteredFiles.filter(f => 
          f.toLowerCase().includes(search.toLowerCase())
        );
      }

      const paginatedFiles = filteredFiles.slice(offset, offset + limit);
      const result: StoredFile[] = [];

      for (const file of paginatedFiles) {
        const metadata = await this.getMetadata(type, file);
        if (metadata) {
          result.push(metadata);
        }
      }

      return result;
    } catch (error) {
      logger.error('Failed to list files', { error, type });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Backup Operations
  // --------------------------------------------------------------------------

  async createBackup(file: StoredFile): Promise<BackupInfo> {
    const now = new Date();
    const backupType = this.getBackupType(now);
    const backupDir = path.join(STORAGE_DIRS.backup, backupType);
    
    const backupFilename = `${now.toISOString().replace(/[:.]/g, '-')}_${file.filename}`;
    const backupPath = path.join(backupDir, backupFilename);

    await copyFile(file.path, backupPath);

    const backupInfo: BackupInfo = {
      id: crypto.randomUUID(),
      sourceFile: file.path,
      backupPath,
      createdAt: now,
      size: file.size,
      checksum: file.checksum,
    };

    // Save backup manifest
    const manifestPath = path.join(STORAGE_DIRS.backup, 'manifest.json');
    let manifest: BackupInfo[] = [];
    
    if (fs.existsSync(manifestPath)) {
      const data = await readFile(manifestPath, 'utf-8');
      manifest = JSON.parse(data);
    }
    
    manifest.push(backupInfo);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    logger.info('Backup created', { backupPath, type: backupType });

    return backupInfo;
  }

  async runScheduledBackup(): Promise<void> {
    logger.info('Starting scheduled backup');

    for (const [type, dir] of Object.entries(STORAGE_DIRS)) {
      if (type === 'backup' || type === 'temp' || type === 'archive') continue;

      try {
        const files = await readdir(dir);
        for (const file of files) {
          if (file.endsWith('.meta.json')) continue;
          
          const filePath = path.join(dir, file);
          const stats = await stat(filePath);
          const data = await readFile(filePath);
          
          const storedFile: StoredFile = {
            id: crypto.randomUUID(),
            filename: file,
            originalName: file,
            mimeType: this.getMimeType(file),
            size: stats.size,
            path: filePath,
            checksum: this.calculateChecksum(data),
            createdAt: stats.birthtime,
          };

          await this.createBackup(storedFile);
        }
      } catch (error) {
        logger.error('Backup failed for directory', { type, error });
      }
    }

    logger.info('Scheduled backup completed');
  }

  async restoreFromBackup(backupId: string): Promise<StoredFile> {
    const manifestPath = path.join(STORAGE_DIRS.backup, 'manifest.json');
    
    if (!fs.existsSync(manifestPath)) {
      throw new Error('Backup manifest not found');
    }

    const manifest: BackupInfo[] = JSON.parse(
      await readFile(manifestPath, 'utf-8')
    );

    const backup = manifest.find(b => b.id === backupId);
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    // Restore file to original location
    await copyFile(backup.backupPath, backup.sourceFile);

    const stats = await stat(backup.sourceFile);
    
    return {
      id: crypto.randomUUID(),
      filename: path.basename(backup.sourceFile),
      originalName: path.basename(backup.sourceFile),
      mimeType: this.getMimeType(backup.sourceFile),
      size: stats.size,
      path: backup.sourceFile,
      checksum: backup.checksum,
      createdAt: new Date(),
    };
  }

  async cleanupOldBackups(retentionDays: number = 30): Promise<number> {
    let deletedCount = 0;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    for (const subDir of ['daily', 'weekly', 'monthly']) {
      const dir = path.join(STORAGE_DIRS.backup, subDir);
      
      try {
        const files = await readdir(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = await stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await unlink(filePath);
            deletedCount++;
          }
        }
      } catch (error) {
        logger.error('Cleanup failed for directory', { subDir, error });
      }
    }

    logger.info('Backup cleanup completed', { deletedCount });
    return deletedCount;
  }

  // --------------------------------------------------------------------------
  // Storage Statistics
  // --------------------------------------------------------------------------

  async getStorageStats(): Promise<{
    totalSize: number;
    byType: Record<string, { count: number; size: number }>;
    backupSize: number;
    freeSpace: number;
  }> {
    await this.initialize();

    const stats: Record<string, { count: number; size: number }> = {};
    let totalSize = 0;
    let backupSize = 0;

    for (const [type, dir] of Object.entries(STORAGE_DIRS)) {
      try {
        const files = await readdir(dir);
        let typeSize = 0;
        let count = 0;

        for (const file of files) {
          if (file.endsWith('.meta.json')) continue;
          
          const filePath = path.join(dir, file);
          try {
            const fileStat = await stat(filePath);
            if (fileStat.isFile()) {
              typeSize += fileStat.size;
              count++;
            }
          } catch {
            // Skip files that can't be accessed
          }
        }

        stats[type] = { count, size: typeSize };
        totalSize += typeSize;
        
        if (type === 'backup') {
          backupSize = typeSize;
        }
      } catch {
        stats[type] = { count: 0, size: 0 };
      }
    }

    return {
      totalSize,
      byType: stats,
      backupSize,
      freeSpace: 0, // Would need OS-specific calls to get actual free space
    };
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  private getBackupType(date: Date): 'daily' | 'weekly' | 'monthly' {
    const day = date.getDate();
    const dayOfWeek = date.getDay();
    
    if (day === 1) return 'monthly';
    if (dayOfWeek === 0) return 'weekly';
    return 'daily';
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 200);
  }

  private calculateChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.webm': 'video/webm',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.pdf': 'application/pdf',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  private async compressData(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const gzip = createGzip();
      const chunks: Buffer[] = [];
      
      gzip.on('data', chunk => chunks.push(chunk));
      gzip.on('end', () => resolve(Buffer.concat(chunks)));
      gzip.on('error', reject);
      
      gzip.write(data);
      gzip.end();
    });
  }

  private async decompressData(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const gunzip = createGunzip();
      const chunks: Buffer[] = [];
      
      gunzip.on('data', chunk => chunks.push(chunk));
      gunzip.on('end', () => resolve(Buffer.concat(chunks)));
      gunzip.on('error', reject);
      
      gunzip.write(data);
      gunzip.end();
    });
  }

  private encryptData(data: Buffer): Buffer {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    // Format: IV (16 bytes) + AuthTag (16 bytes) + Encrypted Data
    return Buffer.concat([iv, authTag, encrypted]);
  }

  private decryptData(data: Buffer): Buffer {
    const iv = data.subarray(0, 16);
    const authTag = data.subarray(16, 32);
    const encrypted = data.subarray(32);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  private async saveMetadata(file: StoredFile): Promise<void> {
    const metadataPath = file.path + '.meta.json';
    await writeFile(metadataPath, JSON.stringify(file, null, 2));
  }

  private async getMetadata(
    type: keyof typeof STORAGE_DIRS,
    filename: string
  ): Promise<StoredFile | null> {
    const metadataPath = path.join(STORAGE_DIRS[type], filename + '.meta.json');
    
    try {
      if (fs.existsSync(metadataPath)) {
        const data = await readFile(metadataPath, 'utf-8');
        return JSON.parse(data);
      }
      
      // Create metadata from file if not exists
      const filePath = path.join(STORAGE_DIRS[type], filename);
      const stats = await stat(filePath);
      const fileData = await readFile(filePath);
      
      return {
        id: crypto.randomUUID(),
        filename,
        originalName: filename,
        mimeType: this.getMimeType(filename),
        size: stats.size,
        path: filePath,
        checksum: this.calculateChecksum(fileData),
        createdAt: stats.birthtime,
      };
    } catch {
      return null;
    }
  }
}

// Export singleton instance
export const localStorageService = new LocalStorageService();
