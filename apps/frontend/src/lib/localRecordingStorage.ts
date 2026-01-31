/**
 * Local Recording Storage using IndexedDB
 * Stores meeting recordings on the user's device instead of cloud storage
 */

const DB_NAME = 'ChatVistaRecordings';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

export interface LocalRecording {
  id: string;
  meetingId: string;
  userId: string;
  title: string;
  blob: Blob;
  mimeType: string;
  size: number;
  duration: number;
  createdAt: Date;
  thumbnailBlob?: Blob;
  metadata?: {
    participants?: string[];
    description?: string;
  };
}

export interface RecordingMetadata {
  id: string;
  meetingId: string;
  userId: string;
  title: string;
  mimeType: string;
  size: number;
  duration: number;
  createdAt: Date;
  hasThumbnail: boolean;
  metadata?: {
    participants?: string[];
    description?: string;
  };
}

class LocalRecordingStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not available'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create recordings store with indexes
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('meetingId', 'meetingId', { unique: false });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Save a recording to local storage
   */
  async saveRecording(recording: LocalRecording): Promise<string> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.put(recording);
      
      request.onsuccess = () => {
        resolve(recording.id);
      };
      
      request.onerror = () => {
        reject(new Error('Failed to save recording'));
      };
    });
  }

  /**
   * Get a recording by ID
   */
  async getRecording(id: string): Promise<LocalRecording | null> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.get(id);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = () => {
        reject(new Error('Failed to get recording'));
      };
    });
  }

  /**
   * Get all recordings for a user
   */
  async getRecordingsByUser(userId: string): Promise<RecordingMetadata[]> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('userId');
      
      const request = index.getAll(userId);
      
      request.onsuccess = () => {
        // Return metadata only (without blob data for list views)
        const recordings = request.result.map((rec: LocalRecording) => ({
          id: rec.id,
          meetingId: rec.meetingId,
          userId: rec.userId,
          title: rec.title,
          mimeType: rec.mimeType,
          size: rec.size,
          duration: rec.duration,
          createdAt: rec.createdAt,
          hasThumbnail: !!rec.thumbnailBlob,
          metadata: rec.metadata,
        }));
        resolve(recordings);
      };
      
      request.onerror = () => {
        reject(new Error('Failed to get recordings'));
      };
    });
  }

  /**
   * Get all recordings for a meeting
   */
  async getRecordingsByMeeting(meetingId: string): Promise<RecordingMetadata[]> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('meetingId');
      
      const request = index.getAll(meetingId);
      
      request.onsuccess = () => {
        const recordings = request.result.map((rec: LocalRecording) => ({
          id: rec.id,
          meetingId: rec.meetingId,
          userId: rec.userId,
          title: rec.title,
          mimeType: rec.mimeType,
          size: rec.size,
          duration: rec.duration,
          createdAt: rec.createdAt,
          hasThumbnail: !!rec.thumbnailBlob,
          metadata: rec.metadata,
        }));
        resolve(recordings);
      };
      
      request.onerror = () => {
        reject(new Error('Failed to get recordings'));
      };
    });
  }

  /**
   * Delete a recording
   */
  async deleteRecording(id: string): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.delete(id);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => {
        reject(new Error('Failed to delete recording'));
      };
    });
  }

  /**
   * Get all recordings (metadata only)
   */
  async getAllRecordings(): Promise<RecordingMetadata[]> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        const recordings = request.result.map((rec: LocalRecording) => ({
          id: rec.id,
          meetingId: rec.meetingId,
          userId: rec.userId,
          title: rec.title,
          mimeType: rec.mimeType,
          size: rec.size,
          duration: rec.duration,
          createdAt: rec.createdAt,
          hasThumbnail: !!rec.thumbnailBlob,
          metadata: rec.metadata,
        }));
        resolve(recordings);
      };
      
      request.onerror = () => {
        reject(new Error('Failed to get recordings'));
      };
    });
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{ count: number; totalSize: number }> {
    const recordings = await this.getAllRecordings();
    return {
      count: recordings.length,
      totalSize: recordings.reduce((acc, rec) => acc + rec.size, 0),
    };
  }

  /**
   * Export a recording as a downloadable file
   */
  async downloadRecording(id: string): Promise<void> {
    const recording = await this.getRecording(id);
    if (!recording) {
      throw new Error('Recording not found');
    }

    const url = URL.createObjectURL(recording.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recording.title}.${this.getExtension(recording.mimeType)}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Create a playable URL for a recording
   */
  async getPlaybackUrl(id: string): Promise<string | null> {
    const recording = await this.getRecording(id);
    if (!recording) return null;
    return URL.createObjectURL(recording.blob);
  }

  /**
   * Get thumbnail URL for a recording
   */
  async getThumbnailUrl(id: string): Promise<string | null> {
    const recording = await this.getRecording(id);
    if (!recording?.thumbnailBlob) return null;
    return URL.createObjectURL(recording.thumbnailBlob);
  }

  private getExtension(mimeType: string): string {
    const map: Record<string, string> = {
      'video/webm': 'webm',
      'video/mp4': 'mp4',
      'audio/webm': 'webm',
      'audio/mp3': 'mp3',
      'audio/mpeg': 'mp3',
    };
    return map[mimeType] || 'webm';
  }

  /**
   * Clear all recordings (use with caution)
   */
  async clearAll(): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.clear();
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => {
        reject(new Error('Failed to clear recordings'));
      };
    });
  }
}

// Export singleton instance
export const localRecordingStorage = new LocalRecordingStorage();

// Utility to generate unique recording IDs
export function generateRecordingId(): string {
  return `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Utility to format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Utility to format duration
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}
