// ============================================================================
// CHATVISTA - Cloud Storage Service
// Digital Ocean Spaces integration for cloud storage
// ============================================================================

import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { localStorageService } from './LocalStorageService';

// ============================================================================
// Types
// ============================================================================

export interface CloudStorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  cdnEndpoint?: string;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: 'private' | 'public-read';
  cacheControl?: string;
  syncToLocal?: boolean;
}

export interface CloudFile {
  key: string;
  bucket: string;
  size: number;
  lastModified: Date;
  etag: string;
  contentType?: string;
  url: string;
  cdnUrl?: string;
}

export interface MultipartUploadSession {
  uploadId: string;
  key: string;
  bucket: string;
  parts: { PartNumber: number; ETag: string }[];
}

// ============================================================================
// Digital Ocean Spaces Configuration
// ============================================================================

const getConfig = (): CloudStorageConfig => ({
  endpoint: process.env.DO_SPACES_ENDPOINT || 'https://nyc3.digitaloceanspaces.com',
  region: process.env.DO_SPACES_REGION || 'nyc3',
  accessKeyId: process.env.DO_SPACES_ACCESS_KEY || '',
  secretAccessKey: process.env.DO_SPACES_SECRET_KEY || '',
  bucket: process.env.DO_SPACES_BUCKET || 'chatvista-storage',
  cdnEndpoint: process.env.DO_SPACES_CDN_ENDPOINT,
});

// ============================================================================
// Cloud Storage Service
// ============================================================================

export class CloudStorageService {
  private client: S3Client;
  private config: CloudStorageConfig;
  private initialized = false;

  constructor() {
    this.config = getConfig();
    this.client = this.createClient();
  }

  private createClient(): S3Client {
    return new S3Client({
      endpoint: this.config.endpoint,
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
      forcePathStyle: false, // Required for DO Spaces
    });
  }

  // --------------------------------------------------------------------------
  // Initialization & Health Check
  // --------------------------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Test connection by listing objects
      await this.client.send(new ListObjectsV2Command({
        Bucket: this.config.bucket,
        MaxKeys: 1,
      }));

      this.initialized = true;
      logger.info('Cloud storage service initialized', { 
        bucket: this.config.bucket,
        region: this.config.region,
      });
    } catch (error) {
      logger.error('Failed to initialize cloud storage', { error });
      throw error;
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const start = Date.now();
    
    try {
      await this.client.send(new ListObjectsV2Command({
        Bucket: this.config.bucket,
        MaxKeys: 1,
      }));
      
      return { healthy: true, latency: Date.now() - start };
    } catch {
      return { healthy: false, latency: Date.now() - start };
    }
  }

  // --------------------------------------------------------------------------
  // File Upload Operations
  // --------------------------------------------------------------------------

  async uploadFile(
    key: string,
    data: Buffer | Readable,
    options: UploadOptions = {}
  ): Promise<CloudFile> {
    await this.initialize();

    const {
      contentType = 'application/octet-stream',
      metadata = {},
      acl = 'private',
      cacheControl = 'max-age=31536000',
      syncToLocal = true,
    } = options;

    try {
      // Convert stream to buffer if needed
      let buffer: Buffer;
      if (Buffer.isBuffer(data)) {
        buffer = data;
      } else {
        const chunks: Buffer[] = [];
        for await (const chunk of data) {
          chunks.push(Buffer.from(chunk));
        }
        buffer = Buffer.concat(chunks);
      }

      // Upload to cloud
      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: acl,
        CacheControl: cacheControl,
        Metadata: {
          ...metadata,
          uploadedAt: new Date().toISOString(),
          checksum: crypto.createHash('md5').update(buffer).digest('hex'),
        },
      });

      await this.client.send(command);

      // Sync to local storage for backup
      if (syncToLocal) {
        try {
          const type = this.getStorageTypeFromKey(key);
          await localStorageService.saveFile(type, key.split('/').pop() || key, buffer, {
            backup: true,
          });
        } catch (error) {
          logger.warn('Failed to sync to local storage', { error, key });
        }
      }

      const cloudFile = await this.getFileInfo(key);
      
      logger.info('File uploaded to cloud storage', { 
        key, 
        size: buffer.length,
        bucket: this.config.bucket,
      });

      return cloudFile;
    } catch (error) {
      logger.error('Failed to upload file to cloud', { error, key });
      throw error;
    }
  }

  async uploadLargeFile(
    key: string,
    data: Buffer | Readable,
    options: UploadOptions = {}
  ): Promise<CloudFile> {
    await this.initialize();

    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
    const { contentType = 'application/octet-stream', metadata = {}, acl = 'private' } = options;

    try {
      // Convert to buffer
      let buffer: Buffer;
      if (Buffer.isBuffer(data)) {
        buffer = data;
      } else {
        const chunks: Buffer[] = [];
        for await (const chunk of data) {
          chunks.push(Buffer.from(chunk));
        }
        buffer = Buffer.concat(chunks);
      }

      // If file is small, use regular upload
      if (buffer.length < CHUNK_SIZE) {
        return this.uploadFile(key, buffer, options);
      }

      // Start multipart upload
      const createCommand = new CreateMultipartUploadCommand({
        Bucket: this.config.bucket,
        Key: key,
        ContentType: contentType,
        ACL: acl,
        Metadata: metadata,
      });

      const { UploadId } = await this.client.send(createCommand);
      
      if (!UploadId) {
        throw new Error('Failed to create multipart upload');
      }

      const parts: { PartNumber: number; ETag: string }[] = [];
      const totalParts = Math.ceil(buffer.length / CHUNK_SIZE);

      // Upload parts
      for (let i = 0; i < totalParts; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, buffer.length);
        const chunk = buffer.subarray(start, end);

        const uploadPartCommand = new UploadPartCommand({
          Bucket: this.config.bucket,
          Key: key,
          UploadId,
          PartNumber: i + 1,
          Body: chunk,
        });

        const { ETag } = await this.client.send(uploadPartCommand);
        
        if (ETag) {
          parts.push({ PartNumber: i + 1, ETag });
        }

        logger.debug('Uploaded part', { 
          key, 
          partNumber: i + 1, 
          totalParts,
          progress: Math.round(((i + 1) / totalParts) * 100),
        });
      }

      // Complete multipart upload
      const completeCommand = new CompleteMultipartUploadCommand({
        Bucket: this.config.bucket,
        Key: key,
        UploadId,
        MultipartUpload: { Parts: parts },
      });

      await this.client.send(completeCommand);

      logger.info('Large file upload completed', { key, size: buffer.length, parts: totalParts });

      return this.getFileInfo(key);
    } catch (error) {
      logger.error('Failed to upload large file', { error, key });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // File Retrieval Operations
  // --------------------------------------------------------------------------

  async getFile(key: string): Promise<Buffer> {
    await this.initialize();

    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });

      const response = await this.client.send(command);
      
      if (!response.Body) {
        throw new Error('Empty response body');
      }

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of response.Body as Readable) {
        chunks.push(Buffer.from(chunk));
      }

      return Buffer.concat(chunks);
    } catch (error) {
      logger.error('Failed to get file from cloud', { error, key });
      throw error;
    }
  }

  async getFileStream(key: string): Promise<Readable> {
    await this.initialize();

    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    const response = await this.client.send(command);
    
    if (!response.Body) {
      throw new Error('Empty response body');
    }

    return response.Body as Readable;
  }

  async getFileInfo(key: string): Promise<CloudFile> {
    await this.initialize();

    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      const url = `${this.config.endpoint}/${this.config.bucket}/${key}`;
      const cdnUrl = this.config.cdnEndpoint 
        ? `${this.config.cdnEndpoint}/${key}`
        : undefined;

      return {
        key,
        bucket: this.config.bucket,
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        etag: response.ETag || '',
        contentType: response.ContentType,
        url,
        cdnUrl,
      };
    } catch (error) {
      logger.error('Failed to get file info', { error, key });
      throw error;
    }
  }

  async getSignedUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    await this.initialize();

    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  async getUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<string> {
    await this.initialize();

    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  // --------------------------------------------------------------------------
  // File Management Operations
  // --------------------------------------------------------------------------

  async deleteFile(key: string): Promise<void> {
    await this.initialize();

    try {
      // Move to archive folder first (soft delete)
      const archiveKey = `archive/${new Date().toISOString().split('T')[0]}/${key}`;
      
      await this.copyFile(key, archiveKey);
      
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });

      await this.client.send(command);

      logger.info('File deleted from cloud storage', { key, archiveKey });
    } catch (error) {
      logger.error('Failed to delete file', { error, key });
      throw error;
    }
  }

  async copyFile(sourceKey: string, destKey: string): Promise<CloudFile> {
    await this.initialize();

    try {
      const command = new CopyObjectCommand({
        Bucket: this.config.bucket,
        CopySource: `${this.config.bucket}/${sourceKey}`,
        Key: destKey,
      });

      await this.client.send(command);

      return this.getFileInfo(destKey);
    } catch (error) {
      logger.error('Failed to copy file', { error, sourceKey, destKey });
      throw error;
    }
  }

  async listFiles(
    prefix: string = '',
    options: { maxKeys?: number; continuationToken?: string } = {}
  ): Promise<{ files: CloudFile[]; nextToken?: string }> {
    await this.initialize();

    const { maxKeys = 1000, continuationToken } = options;

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
        ContinuationToken: continuationToken,
      });

      const response = await this.client.send(command);

      const files: CloudFile[] = (response.Contents || []).map(item => ({
        key: item.Key || '',
        bucket: this.config.bucket,
        size: item.Size || 0,
        lastModified: item.LastModified || new Date(),
        etag: item.ETag || '',
        url: `${this.config.endpoint}/${this.config.bucket}/${item.Key}`,
        cdnUrl: this.config.cdnEndpoint 
          ? `${this.config.cdnEndpoint}/${item.Key}`
          : undefined,
      }));

      return {
        files,
        nextToken: response.NextContinuationToken,
      };
    } catch (error) {
      logger.error('Failed to list files', { error, prefix });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Sync Operations
  // --------------------------------------------------------------------------

  async syncFromLocal(
    _localPath: string,
    cloudPrefix: string = ''
  ): Promise<{ synced: number; failed: number }> {
    await this.initialize();

    let synced = 0;
    let failed = 0;

    try {
      const types: Array<'recordings' | 'transcripts' | 'minutes' | 'exports'> = [
        'recordings', 'transcripts', 'minutes', 'exports'
      ];

      for (const type of types) {
        const files = await localStorageService.listFiles(type);

        for (const file of files) {
          try {
            const data = await localStorageService.getFile(type, file.id);
            const cloudKey = `${cloudPrefix}${type}/${file.filename}`;
            
            await this.uploadFile(cloudKey, data, {
              contentType: file.mimeType,
              syncToLocal: false, // Already in local
            });

            synced++;
          } catch (error) {
            logger.error('Failed to sync file to cloud', { error, fileId: file.id });
            failed++;
          }
        }
      }

      logger.info('Local to cloud sync completed', { synced, failed });
      return { synced, failed };
    } catch (error) {
      logger.error('Sync from local failed', { error });
      throw error;
    }
  }

  async syncToLocal(cloudPrefix: string = ''): Promise<{ synced: number; failed: number }> {
    await this.initialize();

    let synced = 0;
    let failed = 0;

    try {
      const { files } = await this.listFiles(cloudPrefix);

      for (const file of files) {
        try {
          const data = await this.getFile(file.key);
          const type = this.getStorageTypeFromKey(file.key);
          const filename = file.key.split('/').pop() || file.key;

          await localStorageService.saveFile(type, filename, data, {
            backup: true,
          });

          synced++;
        } catch (error) {
          logger.error('Failed to sync file to local', { error, key: file.key });
          failed++;
        }
      }

      logger.info('Cloud to local sync completed', { synced, failed });
      return { synced, failed };
    } catch (error) {
      logger.error('Sync to local failed', { error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  private getStorageTypeFromKey(key: string): 'recordings' | 'transcripts' | 'minutes' | 'exports' | 'avatars' | 'temp' {
    if (key.includes('recording')) return 'recordings';
    if (key.includes('transcript')) return 'transcripts';
    if (key.includes('minute')) return 'minutes';
    if (key.includes('export')) return 'exports';
    if (key.includes('avatar')) return 'avatars';
    return 'temp';
  }

  getPublicUrl(key: string): string {
    if (this.config.cdnEndpoint) {
      return `${this.config.cdnEndpoint}/${key}`;
    }
    return `${this.config.endpoint}/${this.config.bucket}/${key}`;
  }
}

// Export singleton instance
export const cloudStorageService = new CloudStorageService();
