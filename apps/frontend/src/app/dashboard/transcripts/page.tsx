// ============================================================================
// CHATVISTA - Transcripts Page
// View and manage meeting transcripts
// ============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileText,
  Search,
  Download,
  Calendar,
  Clock,
  ChevronRight,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

interface Transcript {
  id: string;
  meetingId: string;
  meetingTitle: string;
  wordCount: number;
  speakerCount: number;
  createdAt: Date;
  language: string;
}

export default function TranscriptsPage() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTranscript, setSelectedTranscript] = useState<Transcript | null>(null);
  const [transcriptContent, setTranscriptContent] = useState<any>(null);

  useEffect(() => {
    loadTranscripts();
  }, []);

  const loadTranscripts = async () => {
    setIsLoading(true);
    try {
      const data = await api.transcripts.list();
      setTranscripts(data);
    } catch (error) {
      console.error('Failed to load transcripts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewTranscript = async (transcript: Transcript) => {
    setSelectedTranscript(transcript);
    try {
      const content = await api.transcripts.get(transcript.id);
      setTranscriptContent(content);
    } catch (error) {
      console.error('Failed to load transcript content:', error);
    }
  };

  const handleDownload = async (transcriptId: string, format: 'txt' | 'srt' | 'vtt') => {
    try {
      const { url } = await api.transcripts.download(transcriptId, format);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Failed to download transcript:', error);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredTranscripts = transcripts.filter((t) =>
    t.meetingTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Transcripts</h1>
              <p className="text-gray-400">View and manage meeting transcripts</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Search */}
        <div className="flex items-center justify-between mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search transcripts..."
              className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-80"
            />
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-3 gap-6">
          {/* Transcript list */}
          <div className="col-span-1 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : filteredTranscripts.length > 0 ? (
              filteredTranscripts.map((transcript) => (
                <button
                  key={transcript.id}
                  onClick={() => handleViewTranscript(transcript)}
                  className={`w-full text-left p-4 rounded-xl transition-colors ${
                    selectedTranscript?.id === transcript.id
                      ? 'bg-blue-500/20 border border-blue-500/30'
                      : 'bg-gray-800 border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <h3 className="text-white font-medium truncate mb-1">
                    {transcript.meetingTitle}
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(transcript.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>{transcript.wordCount} words</span>
                    <span>•</span>
                    <span>{transcript.speakerCount} speakers</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">
                  {searchQuery ? 'No transcripts match your search' : 'No transcripts yet'}
                </p>
              </div>
            )}
          </div>

          {/* Transcript viewer */}
          <div className="col-span-2">
            {selectedTranscript ? (
              <div className="bg-gray-800 border border-gray-700 rounded-2xl h-full">
                {/* Viewer header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {selectedTranscript.meetingTitle}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {formatDate(selectedTranscript.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                      onChange={(e) => handleDownload(selectedTranscript.id, e.target.value as any)}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Download as...
                      </option>
                      <option value="txt">Plain Text (.txt)</option>
                      <option value="srt">SubRip (.srt)</option>
                      <option value="vtt">WebVTT (.vtt)</option>
                    </select>
                  </div>
                </div>

                {/* Transcript content */}
                <div className="p-6 max-h-[600px] overflow-y-auto">
                  {transcriptContent ? (
                    <div className="space-y-4">
                      {transcriptContent.entries?.map((entry: any, index: number) => (
                        <div key={index} className="flex gap-4">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
                              {entry.speaker[0]}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-blue-400 font-medium">
                                {entry.speaker}
                              </span>
                              <span className="text-xs text-gray-500">
                                {entry.timestamp}
                              </span>
                            </div>
                            <p className="text-gray-300">{entry.text}</p>
                          </div>
                        </div>
                      )) || (
                        <p className="text-gray-400 text-center py-8">
                          Loading transcript content...
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-800 border border-gray-700 rounded-2xl h-full flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Select a transcript
                  </h3>
                  <p className="text-gray-400">
                    Choose a transcript from the list to view its content
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
