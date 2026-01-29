// ============================================================================
// CHATVISTA - Meeting Minutes Page
// View and manage AI-generated meeting minutes
// ============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Download,
  Calendar,
  Users,
  Clock,
  ChevronRight,
  Loader2,
  ListChecks,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

interface MeetingMinutes {
  id: string;
  meetingId: string;
  meetingTitle: string;
  createdAt: Date;
  summary: string;
  keyPoints: string[];
  actionItems: Array<{
    description: string;
    assignee?: string;
    dueDate?: string;
  }>;
  decisions: string[];
  participants: string[];
  duration: number;
}

export default function MinutesPage() {
  const [minutes, setMinutes] = useState<MeetingMinutes[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMinutes, setSelectedMinutes] = useState<MeetingMinutes | null>(null);

  useEffect(() => {
    loadMinutes();
  }, []);

  const loadMinutes = async () => {
    setIsLoading(true);
    try {
      const data = await api.minutes.list();
      setMinutes(data);
    } catch (error) {
      console.error('Failed to load minutes:', error);
      // Mock data for demonstration
      setMinutes([
        {
          id: '1',
          meetingId: 'meeting-1',
          meetingTitle: 'Weekly Team Standup',
          createdAt: new Date(),
          summary: 'The team discussed current project status, blockers, and upcoming milestones. Key focus areas include the Q1 product launch and infrastructure improvements.',
          keyPoints: [
            'Q1 product launch on track for March 15th',
            'New team member onboarding completed',
            'Infrastructure migration 80% complete',
            'Customer feedback review scheduled for next week',
          ],
          actionItems: [
            { description: 'Finalize API documentation', assignee: 'John Doe', dueDate: '2026-02-01' },
            { description: 'Review security audit report', assignee: 'Jane Smith', dueDate: '2026-01-30' },
            { description: 'Schedule user testing sessions', assignee: 'Mike Johnson', dueDate: '2026-02-05' },
          ],
          decisions: [
            'Approved budget increase for cloud infrastructure',
            'Agreed to postpone feature X to Q2',
            'Selected vendor A for analytics integration',
          ],
          participants: ['John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Wilson'],
          duration: 45,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async (minutesId: string) => {
    try {
      await api.minutes.regenerate(minutesId);
      loadMinutes();
    } catch (error) {
      console.error('Failed to regenerate minutes:', error);
    }
  };

  const handleDownload = async (minutesId: string, format: 'pdf' | 'docx' | 'txt') => {
    try {
      const { url } = await api.minutes.download(minutesId, format);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Failed to download minutes:', error);
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

  const formatDuration = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins} min`;
  };

  const filteredMinutes = minutes.filter((m) =>
    m.meetingTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-blue-400" />
                Meeting Minutes
              </h1>
              <p className="text-gray-400">AI-generated summaries and action items</p>
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
              placeholder="Search meeting minutes..."
              className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-80"
            />
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : selectedMinutes ? (
          // Minutes detail view
          <div className="space-y-6">
            {/* Back button */}
            <button
              onClick={() => setSelectedMinutes(null)}
              className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
            >
              ← Back to list
            </button>

            {/* Header */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    {selectedMinutes.meetingTitle}
                  </h2>
                  <div className="flex items-center gap-4 text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(selectedMinutes.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDuration(selectedMinutes.duration)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {selectedMinutes.participants.length} participants
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRegenerate(selectedMinutes.id)}
                    className="p-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                    title="Regenerate minutes"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                  <select
                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                    onChange={(e) => handleDownload(selectedMinutes.id, e.target.value as any)}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Download
                    </option>
                    <option value="pdf">PDF</option>
                    <option value="docx">Word</option>
                    <option value="txt">Text</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                Summary
              </h3>
              <p className="text-gray-300 leading-relaxed">{selectedMinutes.summary}</p>
            </div>

            {/* Key Points */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Key Points</h3>
              <ul className="space-y-3">
                {selectedMinutes.keyPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 text-sm font-medium">
                      {index + 1}
                    </div>
                    <span className="text-gray-300">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action Items */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-green-400" />
                Action Items
              </h3>
              <div className="space-y-3">
                {selectedMinutes.actionItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 bg-gray-700/50 rounded-xl"
                  >
                    <input type="checkbox" className="mt-1" />
                    <div className="flex-1">
                      <p className="text-white">{item.description}</p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                        {item.assignee && (
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {item.assignee}
                          </span>
                        )}
                        {item.dueDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {item.dueDate}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Decisions */}
            {selectedMinutes.decisions.length > 0 && (
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Decisions Made</h3>
                <ul className="space-y-2">
                  {selectedMinutes.decisions.map((decision, index) => (
                    <li key={index} className="flex items-start gap-3 text-gray-300">
                      <span className="text-green-400">✓</span>
                      {decision}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Participants */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Participants</h3>
              <div className="flex flex-wrap gap-2">
                {selectedMinutes.participants.map((participant, index) => (
                  <span
                    key={index}
                    className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded-full"
                  >
                    {participant}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Minutes list
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMinutes.length > 0 ? (
              filteredMinutes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMinutes(m)}
                  className="text-left bg-gray-800 border border-gray-700 rounded-2xl p-6 hover:border-gray-600 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-blue-400" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-gray-300 transition-colors" />
                  </div>

                  <h3 className="text-white font-semibold mb-2 truncate">
                    {m.meetingTitle}
                  </h3>
                  <p className="text-gray-400 text-sm line-clamp-2 mb-4">
                    {m.summary}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(m.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <ListChecks className="w-4 h-4" />
                      {m.actionItems.length} actions
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="col-span-full text-center py-20">
                <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No meeting minutes yet</h3>
                <p className="text-gray-400">
                  {searchQuery
                    ? 'No minutes match your search'
                    : 'Enable transcription in your meetings to generate AI-powered minutes'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
