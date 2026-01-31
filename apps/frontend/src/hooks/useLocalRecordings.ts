'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  localRecordingStorage,
  LocalRecording,
  RecordingMetadata,
  generateRecordingId,
} from '@/lib/localRecordingStorage';

interface UseLocalRecordingsOptions {
  userId?: string;
  meetingId?: string;
  autoLoad?: boolean;
}

interface UseLocalRecordingsReturn {
  recordings: RecordingMetadata[];
  isLoading: boolean;
  error: Error | null;
  saveRecording: (params: {
    meetingId: string;
    userId: string;
    title: string;
    blob: Blob;
    duration: number;
    thumbnailBlob?: Blob;
    participants?: string[];
    description?: string;
  }) => Promise<string>;
  deleteRecording: (id: string) => Promise<void>;
  getRecording: (id: string) => Promise<LocalRecording | null>;
  getPlaybackUrl: (id: string) => Promise<string | null>;
  downloadRecording: (id: string) => Promise<void>;
  refreshRecordings: () => Promise<void>;
  storageStats: { count: number; totalSize: number } | null;
}

export function useLocalRecordings(
  options: UseLocalRecordingsOptions = {}
): UseLocalRecordingsReturn {
  const { userId, meetingId, autoLoad = true } = options;
  const [recordings, setRecordings] = useState<RecordingMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [storageStats, setStorageStats] = useState<{
    count: number;
    totalSize: number;
  } | null>(null);

  const loadRecordings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let result: RecordingMetadata[];

      if (userId) {
        result = await localRecordingStorage.getRecordingsByUser(userId);
      } else if (meetingId) {
        result = await localRecordingStorage.getRecordingsByMeeting(meetingId);
      } else {
        result = await localRecordingStorage.getAllRecordings();
      }

      // Sort by createdAt descending
      result.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setRecordings(result);

      // Update storage stats
      const stats = await localRecordingStorage.getStorageStats();
      setStorageStats(stats);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load recordings'));
    } finally {
      setIsLoading(false);
    }
  }, [userId, meetingId]);

  useEffect(() => {
    if (autoLoad) {
      loadRecordings();
    }
  }, [autoLoad, loadRecordings]);

  const saveRecording = useCallback(
    async (params: {
      meetingId: string;
      userId: string;
      title: string;
      blob: Blob;
      duration: number;
      thumbnailBlob?: Blob;
      participants?: string[];
      description?: string;
    }): Promise<string> => {
      const recording: LocalRecording = {
        id: generateRecordingId(),
        meetingId: params.meetingId,
        userId: params.userId,
        title: params.title,
        blob: params.blob,
        mimeType: params.blob.type,
        size: params.blob.size,
        duration: params.duration,
        createdAt: new Date(),
        thumbnailBlob: params.thumbnailBlob,
        metadata: {
          participants: params.participants,
          description: params.description,
        },
      };

      const id = await localRecordingStorage.saveRecording(recording);
      await loadRecordings();
      return id;
    },
    [loadRecordings]
  );

  const deleteRecording = useCallback(
    async (id: string): Promise<void> => {
      await localRecordingStorage.deleteRecording(id);
      await loadRecordings();
    },
    [loadRecordings]
  );

  const getRecording = useCallback(
    async (id: string): Promise<LocalRecording | null> => {
      return localRecordingStorage.getRecording(id);
    },
    []
  );

  const getPlaybackUrl = useCallback(
    async (id: string): Promise<string | null> => {
      return localRecordingStorage.getPlaybackUrl(id);
    },
    []
  );

  const downloadRecording = useCallback(
    async (id: string): Promise<void> => {
      return localRecordingStorage.downloadRecording(id);
    },
    []
  );

  return {
    recordings,
    isLoading,
    error,
    saveRecording,
    deleteRecording,
    getRecording,
    getPlaybackUrl,
    downloadRecording,
    refreshRecordings: loadRecordings,
    storageStats,
  };
}
