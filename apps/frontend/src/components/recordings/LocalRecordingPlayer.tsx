'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download, Trash2, Clock, HardDrive } from 'lucide-react';
import { RecordingMetadata, formatFileSize, formatDuration } from '@/lib/localRecordingStorage';
import { useLocalRecordings } from '@/hooks/useLocalRecordings';

interface LocalRecordingPlayerProps {
  recording: RecordingMetadata;
  onDelete?: (id: string) => void;
}

export function LocalRecordingPlayer({ recording, onDelete }: LocalRecordingPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { getPlaybackUrl, downloadRecording, deleteRecording } = useLocalRecordings({
    autoLoad: false,
  });

  useEffect(() => {
    // Cleanup playback URL on unmount
    return () => {
      if (playbackUrl) {
        URL.revokeObjectURL(playbackUrl);
      }
    };
  }, [playbackUrl]);

  const handlePlay = async () => {
    if (!playbackUrl) {
      const url = await getPlaybackUrl(recording.id);
      if (url) {
        setPlaybackUrl(url);
        // Wait for URL to be set before playing
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.play();
            setIsPlaying(true);
          }
        }, 100);
      }
    } else if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleDownload = async () => {
    await downloadRecording(recording.id);
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this recording? This cannot be undone.')) {
      setIsDeleting(true);
      try {
        await deleteRecording(recording.id);
        onDelete?.(recording.id);
      } catch (error) {
        console.error('Failed to delete recording:', error);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const progress = recording.duration > 0 ? (currentTime / recording.duration) * 100 : 0;

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
      {/* Video/Audio Player */}
      <div className="relative aspect-video bg-gray-900">
        {playbackUrl ? (
          <video
            ref={videoRef}
            src={playbackUrl}
            className="w-full h-full"
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={handlePlay}
              className="w-16 h-16 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center transition-colors"
            >
              <Play className="w-8 h-8 text-white ml-1" />
            </button>
          </div>
        )}

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Info and Controls */}
      <div className="p-4">
        <h3 className="font-semibold text-white truncate mb-2">{recording.title}</h3>
        
        <div className="flex items-center text-sm text-gray-400 space-x-4 mb-3">
          <div className="flex items-center">
            <Clock className="w-4 h-4 mr-1" />
            {formatDuration(recording.duration)}
          </div>
          <div className="flex items-center">
            <HardDrive className="w-4 h-4 mr-1" />
            {formatFileSize(recording.size)}
          </div>
        </div>

        <div className="text-xs text-gray-500 mb-3">
          {new Date(recording.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <button
            onClick={handlePlay}
            className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Play
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface LocalRecordingsListProps {
  userId?: string;
  meetingId?: string;
}

export function LocalRecordingsList({ userId, meetingId }: LocalRecordingsListProps) {
  const { recordings, isLoading, error, refreshRecordings, storageStats } = useLocalRecordings({
    userId,
    meetingId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-red-400">
        <p>Failed to load recordings</p>
        <button
          onClick={refreshRecordings}
          className="mt-2 text-blue-400 hover:text-blue-300"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Storage Stats */}
      {storageStats && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">
              {storageStats.count} recording{storageStats.count !== 1 ? 's' : ''} stored locally
            </span>
            <span className="text-gray-400 flex items-center">
              <HardDrive className="w-4 h-4 mr-1" />
              {formatFileSize(storageStats.totalSize)} used
            </span>
          </div>
        </div>
      )}

      {/* Recordings Grid */}
      {recordings.length === 0 ? (
        <div className="text-center p-8 text-gray-400">
          <p>No recordings yet</p>
          <p className="text-sm mt-1">Your meeting recordings will appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recordings.map((recording) => (
            <LocalRecordingPlayer
              key={recording.id}
              recording={recording}
              onDelete={() => refreshRecordings()}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default LocalRecordingsList;
