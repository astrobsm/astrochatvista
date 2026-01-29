// ============================================================================
// CHATVISTA - Recordings Page
// View and playback meeting recordings
// ============================================================================

'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Play,
  Pause,
  Download,
  Trash2,
  Search,
  Filter,
  Calendar,
  Clock,
  Video,
  Volume2,
  VolumeX,
  Maximize,
  SkipBack,
  SkipForward,
  X,
  FileText,
  Share2,
  MoreVertical,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface Recording {
  id: string;
  meetingId: string;
  meetingTitle: string;
  duration: number;
  size: number;
  createdAt: Date;
  thumbnailUrl?: string;
  url?: string;
  status: 'processing' | 'ready' | 'failed';
}

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    setIsLoading(true);
    try {
      const data = await api.recordings.list();
      setRecordings(data);
    } catch (error) {
      console.error('Failed to load recordings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recording? This action cannot be undone.')) {
      return;
    }

    try {
      await api.recordings.delete(id);
      setRecordings(recordings.filter((r) => r.id !== id));
      if (selectedRecording?.id === id) {
        setSelectedRecording(null);
      }
    } catch (error) {
      console.error('Failed to delete recording:', error);
    }
  };

  const handleDownload = async (recording: Recording) => {
    try {
      const { url } = await api.recordings.getDownloadUrl(recording.id);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Failed to get download URL:', error);
    }
  };

  const handlePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const time = parseFloat(e.target.value);
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const vol = parseFloat(e.target.value);
    videoRef.current.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const filteredRecordings = recordings.filter((r) =>
    r.meetingTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Recordings</h1>
              <p className="text-gray-400">View and manage your meeting recordings</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Search and filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recordings..."
              className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-80"
            />
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span>{recordings.length} recordings</span>
            <span>•</span>
            <span>
              {formatFileSize(recordings.reduce((acc, r) => acc + r.size, 0))} total
            </span>
          </div>
        </div>

        {/* Recordings grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredRecordings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecordings.map((recording) => (
              <div
                key={recording.id}
                className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden hover:border-gray-600 transition-colors group"
              >
                {/* Thumbnail */}
                <div
                  className="relative aspect-video bg-gray-900 cursor-pointer"
                  onClick={() => setSelectedRecording(recording)}
                >
                  {recording.thumbnailUrl ? (
                    <img
                      src={recording.thumbnailUrl}
                      alt={recording.meetingTitle}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="w-12 h-12 text-gray-700" />
                    </div>
                  )}

                  {/* Play overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                      <Play className="w-8 h-8 text-white ml-1" />
                    </div>
                  </div>

                  {/* Duration badge */}
                  <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 text-white text-xs font-medium rounded">
                    {formatDuration(recording.duration)}
                  </div>

                  {/* Status badge */}
                  {recording.status !== 'ready' && (
                    <div className={`absolute top-2 left-2 px-2 py-1 text-xs font-medium rounded ${
                      recording.status === 'processing'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {recording.status === 'processing' ? 'Processing...' : 'Failed'}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="text-white font-medium truncate mb-1">
                    {recording.meetingTitle}
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-gray-400 mb-4">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(recording.createdAt)}
                    </span>
                    <span>•</span>
                    <span>{formatFileSize(recording.size)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedRecording(recording)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
                      disabled={recording.status !== 'ready'}
                    >
                      <Play className="w-4 h-4" />
                      Play
                    </button>
                    <button
                      onClick={() => handleDownload(recording)}
                      className="p-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                      disabled={recording.status !== 'ready'}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(recording.id)}
                      className="p-2 bg-gray-700 text-red-400 rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Video className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No recordings yet</h3>
            <p className="text-gray-400 mb-6">
              {searchQuery
                ? 'No recordings match your search'
                : 'Start a meeting and enable recording to see it here'}
            </p>
            <Link href="/dashboard/meetings">
              <Button>View Meetings</Button>
            </Link>
          </div>
        )}
      </div>

      {/* Video Player Modal */}
      {selectedRecording && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {selectedRecording.meetingTitle}
              </h2>
              <p className="text-sm text-gray-400">
                {formatDate(selectedRecording.createdAt)} • {formatDuration(selectedRecording.duration)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownload(selectedRecording)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={() => setSelectedRecording(null)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Video */}
          <div className="flex-1 flex items-center justify-center px-8">
            <video
              ref={videoRef}
              src={selectedRecording.url}
              className="max-w-full max-h-full rounded-lg"
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onEnded={() => setIsPlaying(false)}
            />
          </div>

          {/* Controls */}
          <div className="p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="max-w-4xl mx-auto">
              {/* Progress bar */}
              <div className="mb-4">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1 bg-gray-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>{formatDuration(currentTime)}</span>
                  <span>{formatDuration(duration)}</span>
                </div>
              </div>

              {/* Control buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => {
                      if (videoRef.current) videoRef.current.currentTime -= 10;
                    }}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <SkipBack className="w-5 h-5" />
                  </button>

                  <button
                    onClick={handlePlayPause}
                    className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5 ml-0.5" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      if (videoRef.current) videoRef.current.currentTime += 10;
                    }}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  {/* Volume */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleMute}
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-5 h-5" />
                      ) : (
                        <Volume2 className="w-5 h-5" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-20 h-1 bg-gray-700 rounded-full appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Fullscreen */}
                  <button
                    onClick={() => videoRef.current?.requestFullscreen()}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <Maximize className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
