// ============================================================================
// CHATVISTA - Transcript Panel Component
// Real-time meeting transcript with speaker identification
// ============================================================================

'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Search,
  Download,
  Copy,
  Check,
  Pause,
  Play,
  Settings,
  Languages,
} from 'lucide-react';

interface TranscriptEntry {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  timestamp: Date;
  confidence?: number;
  language?: string;
  isFinal: boolean;
}

interface TranscriptPanelProps {
  entries?: TranscriptEntry[];
  isLive?: boolean;
  onClose?: () => void;
  onDownload?: () => void;
  onToggleLive?: () => void;
  meetingId?: string;
}

export function TranscriptPanel({
  entries = [],
  isLive = true,
  onClose,
  onDownload,
  onToggleLive,
  meetingId: _meetingId,
}: TranscriptPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (autoScroll && isLive) {
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, autoScroll, isLive]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const filteredEntries = entries.filter(
    (entry) =>
      entry.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.speakerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const copyTranscript = async () => {
    const text = entries
      .map((e) => `[${formatTime(e.timestamp)}] ${e.speakerName}: ${e.text}`)
      .join('\n');

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Group consecutive entries by speaker
  const groupedEntries = filteredEntries.reduce((groups, entry, index) => {
    const prevEntry = filteredEntries[index - 1];
    const shouldGroup =
      prevEntry &&
      prevEntry.speakerId === entry.speakerId &&
      new Date(entry.timestamp).getTime() -
        new Date(prevEntry.timestamp).getTime() <
        30000; // 30 seconds

    if (shouldGroup && groups.length > 0) {
      const lastGroup = groups[groups.length - 1];
      lastGroup.entries.push(entry);
    } else {
      groups.push({
        speakerId: entry.speakerId,
        speakerName: entry.speakerName,
        startTime: entry.timestamp,
        entries: [entry],
      });
    }

    return groups;
  }, [] as Array<{ speakerId: string; speakerName: string; startTime: Date; entries: TranscriptEntry[] }>);

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ja', name: 'Japanese' },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-900/95 backdrop-blur border-l border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Transcript</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">
                {entries.length} entries
              </span>
              {isLive && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  Live
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onToggleLive && (
            <button
              onClick={onToggleLive}
              className={`p-2 rounded-lg transition-colors ${
                isLive
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-700 text-gray-400'
              }`}
              title={isLive ? 'Pause transcription' : 'Resume transcription'}
            >
              {isLive ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-3 border-b border-gray-700 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transcript..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={copyTranscript}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-600 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-400" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy
              </>
            )}
          </button>

          {onDownload && (
            <button
              onClick={onDownload}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-600 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          )}

          <div className="flex-1" />

          {/* Language selector */}
          <div className="relative">
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="appearance-none pl-8 pr-4 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
            <Languages className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Transcript entries */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {groupedEntries.map((group, groupIndex) => (
          <div key={`${group.speakerId}-${groupIndex}`} className="space-y-1">
            {/* Speaker header */}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
                {group.speakerName[0].toUpperCase()}
              </div>
              <span className="font-medium text-white">{group.speakerName}</span>
              <span className="text-xs text-gray-500">
                {formatTime(group.startTime)}
              </span>
            </div>

            {/* Entries */}
            <div className="pl-10 space-y-1">
              {group.entries.map((entry) => (
                <div
                  key={entry.id}
                  className={`
                    p-2 rounded-lg transition-colors
                    ${entry.isFinal ? 'bg-gray-800/50' : 'bg-gray-800/30 italic'}
                    ${!entry.isFinal ? 'animate-pulse' : ''}
                  `}
                >
                  <p className="text-sm text-white leading-relaxed">
                    {entry.text}
                    {!entry.isFinal && (
                      <span className="ml-2 text-gray-500">...</span>
                    )}
                  </p>

                  {entry.confidence !== undefined && entry.confidence < 0.8 && (
                    <span className="text-xs text-yellow-500 mt-1 block">
                      Low confidence ({Math.round(entry.confidence * 100)}%)
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Languages className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-center">
              {isLive
                ? 'Waiting for speech...'
                : 'No transcript available for this meeting.'}
            </p>
            {isLive && (
              <p className="text-sm text-gray-600 mt-2">
                Start speaking to see the transcript
              </p>
            )}
          </div>
        )}

        <div ref={transcriptEndRef} />
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && isLive && entries.length > 0 && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
          <button
            onClick={() => {
              setAutoScroll(true);
              transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-4 py-2 bg-blue-500 text-white text-sm rounded-full shadow-lg hover:bg-blue-600 transition-colors"
          >
            Resume auto-scroll
          </button>
        </div>
      )}

      {/* Stats footer */}
      <div className="p-3 border-t border-gray-700 bg-gray-800/50">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>
            Words: {entries.reduce((acc, e) => acc + e.text.split(' ').length, 0)}
          </span>
          <span>
            Duration: {entries.length > 0
              ? formatDuration(
                  new Date(entries[entries.length - 1].timestamp).getTime() -
                    new Date(entries[0].timestamp).getTime()
                )
              : '0:00'}
          </span>
          <span>Language: {languages.find((l) => l.code === selectedLanguage)?.name}</span>
        </div>
      </div>
    </div>
  );
}

// Helper function to format duration
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60)
      .toString()
      .padStart(2, '0')}`;
  }

  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}
