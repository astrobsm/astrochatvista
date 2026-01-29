// ============================================================================
// CHATVISTA - Meetings List Page
// List all user's meetings
// ============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Video,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  Users,
  Play,
  FileText,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

interface Meeting {
  id: string;
  title: string;
  description?: string;
  scheduledAt: Date;
  duration: number;
  participantCount: number;
  status: 'scheduled' | 'live' | 'ended';
  hasRecording: boolean;
  hasTranscript: boolean;
}

export default function MeetingsPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadMeetings();
  }, [page, filter]);

  const loadMeetings = async () => {
    setIsLoading(true);
    try {
      const data = await api.meetings.list({
        page,
        limit: 10,
        status: filter === 'all' ? undefined : filter === 'upcoming' ? 'scheduled' : 'ended',
      });
      setMeetings(data.meetings);
      setTotalPages(Math.ceil(data.total / 10));
    } catch (error) {
      console.error('Failed to load meetings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateMeeting = async () => {
    try {
      const meeting = await api.meetings.create({
        title: 'New Meeting',
        scheduledStartTime: new Date(),
      });
      router.push(`/meeting/${meeting.id}`);
    } catch (error) {
      console.error('Failed to create meeting:', error);
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    if (!confirm('Are you sure you want to delete this meeting?')) return;
    
    try {
      await api.meetings.delete(id);
      setMeetings(meetings.filter((m) => m.id !== id));
    } catch (error) {
      console.error('Failed to delete meeting:', error);
    }
  };

  const filteredMeetings = meetings.filter((m) =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Meetings</h1>
              <p className="text-gray-400">Manage your meetings and view recordings</p>
            </div>
            <Button onClick={handleCreateMeeting} leftIcon={Plus}>
              New Meeting
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Filters and search */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {(['all', 'upcoming', 'past'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === f
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search meetings..."
                className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
            </div>
          </div>
        </div>

        {/* Meetings table */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          ) : filteredMeetings.length > 0 ? (
            <>
              <table className="w-full">
                <thead className="bg-gray-900">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Meeting</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Date & Time</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Participants</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Media</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredMeetings.map((meeting) => (
                    <tr key={meeting.id} className="hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            meeting.status === 'live' ? 'bg-green-500/20' : 'bg-gray-700'
                          }`}>
                            <Video className={`w-5 h-5 ${
                              meeting.status === 'live' ? 'text-green-400' : 'text-gray-400'
                            }`} />
                          </div>
                          <div>
                            <p className="text-white font-medium">{meeting.title}</p>
                            {meeting.description && (
                              <p className="text-sm text-gray-400 truncate max-w-xs">
                                {meeting.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-white">{formatDate(meeting.scheduledAt)}</div>
                        <div className="text-sm text-gray-400">{formatTime(meeting.scheduledAt)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-300">
                          <Users className="w-4 h-4" />
                          {meeting.participantCount}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          meeting.status === 'live'
                            ? 'bg-green-500/20 text-green-400'
                            : meeting.status === 'scheduled'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-gray-700 text-gray-400'
                        }`}>
                          {meeting.status === 'live' && (
                            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                          )}
                          {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {meeting.hasRecording && (
                            <button className="p-1 text-gray-400 hover:text-white transition-colors" title="View Recording">
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          {meeting.hasTranscript && (
                            <button className="p-1 text-gray-400 hover:text-white transition-colors" title="View Transcript">
                              <FileText className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/meeting/${meeting.id}`}
                            className="px-3 py-1.5 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
                          >
                            {meeting.status === 'live' ? 'Join' : 'View'}
                          </Link>
                          <button
                            onClick={() => handleDeleteMeeting(meeting.id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700">
                <p className="text-sm text-gray-400">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center">
              <Video className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No meetings found</h3>
              <p className="text-gray-400 mb-6">
                {searchQuery
                  ? 'Try adjusting your search'
                  : "You haven't created any meetings yet"}
              </p>
              <Button onClick={handleCreateMeeting} leftIcon={Plus}>
                Create Your First Meeting
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
