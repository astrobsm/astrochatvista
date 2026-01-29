// ============================================================================
// CHATVISTA - Dashboard Page
// Main dashboard for authenticated users
// ============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Video,
  Plus,
  Calendar,
  Clock,
  Users,
  FileText,
  Settings,
  LogOut,
  Search,
  Bell,
  ChevronRight,
  Play,
  MoreVertical,
  Mic,
  Copy,
  ExternalLink,
  TrendingUp,
  BarChart2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { JoinMeetingModal, ScheduleMeetingModal } from '@/components/modals';

interface Meeting {
  id: string;
  title: string;
  scheduledAt: Date;
  duration: number;
  participantCount: number;
  status: 'scheduled' | 'live' | 'ended';
  hasRecording: boolean;
  hasTranscript: boolean;
}

interface DashboardStats {
  totalMeetings: number;
  totalMinutes: number;
  upcomingMeetings: number;
  recordings: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewMeetingModal, setShowNewMeetingModal] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [profileData, meetingsData, analyticsData] = await Promise.all([
        api.auth.getProfile(),
        api.meetings.list({ limit: 10 }),
        api.analytics.getDashboard(),
      ]);

      setUser(profileData);
      setMeetings(meetingsData.meetings);
      setStats(analyticsData);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateMeeting = async () => {
    try {
      const meeting = await api.meetings.create({
        title: 'New Meeting',
        type: 'INSTANT',
      });
      router.push(`/meeting/${meeting.id}`);
    } catch (error) {
      console.error('Failed to create meeting:', error);
    }
  };

  const handleLogout = async () => {
    await api.auth.logout();
    router.push('/login');
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-700">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
              <Video className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">ChatVista</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-3 bg-blue-500/10 text-blue-400 rounded-xl"
          >
            <BarChart2 className="w-5 h-5" />
            Dashboard
          </Link>

          <Link
            href="/dashboard/meetings"
            className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-700 rounded-xl transition-colors"
          >
            <Calendar className="w-5 h-5" />
            Meetings
          </Link>

          <Link
            href="/dashboard/recordings"
            className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-700 rounded-xl transition-colors"
          >
            <Play className="w-5 h-5" />
            Recordings
          </Link>

          <Link
            href="/dashboard/transcripts"
            className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-700 rounded-xl transition-colors"
          >
            <FileText className="w-5 h-5" />
            Transcripts
          </Link>

          <Link
            href="/dashboard/analytics"
            className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-700 rounded-xl transition-colors"
          >
            <TrendingUp className="w-5 h-5" />
            Analytics
          </Link>

          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-700 rounded-xl transition-colors"
          >
            <Settings className="w-5 h-5" />
            Settings
          </Link>
        </nav>

        {/* User */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center gap-3 p-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{user?.name}</p>
              <p className="text-gray-400 text-sm truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-700">
          <div className="flex items-center justify-between px-8 py-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Dashboard</h1>
              <p className="text-gray-400">Welcome back, {user?.name?.split(' ')[0]}</p>
            </div>

            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search meetings..."
                  className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                />
              </div>

              {/* Notifications */}
              <button className="relative p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-xl transition-colors">
                <Bell className="w-6 h-6" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              {/* New meeting */}
              <button
                onClick={handleCreateMeeting}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 transition-colors"
              >
                <Plus className="w-5 h-5" />
                New Meeting
              </button>
            </div>
          </div>
        </header>

        <div className="p-8">
          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <button
              onClick={handleCreateMeeting}
              className="flex items-center gap-4 p-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl hover:opacity-90 transition-colors"
            >
              <div className="p-3 bg-white/20 rounded-xl">
                <Video className="w-8 h-8 text-white" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-white">Start Meeting</h3>
                <p className="text-white/80 text-sm">Start an instant meeting</p>
              </div>
            </button>

            <button
              onClick={() => setIsScheduleModalOpen(true)}
              className="flex items-center gap-4 p-6 bg-gray-800 border border-gray-700 rounded-2xl hover:bg-gray-700 transition-colors"
            >
              <div className="p-3 bg-orange-500/20 rounded-xl">
                <Calendar className="w-8 h-8 text-orange-400" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-white">Schedule</h3>
                <p className="text-gray-400 text-sm">Plan a future meeting</p>
              </div>
            </button>

            <button
              onClick={() => setIsJoinModalOpen(true)}
              className="flex items-center gap-4 p-6 bg-gray-800 border border-gray-700 rounded-2xl hover:bg-gray-700 transition-colors"
            >
              <div className="p-3 bg-green-500/20 rounded-xl">
                <ExternalLink className="w-8 h-8 text-green-400" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-white">Join Meeting</h3>
                <p className="text-gray-400 text-sm">Join with a meeting code</p>
              </div>
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="p-6 bg-gray-800 border border-gray-700 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Video className="w-6 h-6 text-blue-400" />
                </div>
                <span className="text-green-400 text-sm font-medium">+12%</span>
              </div>
              <p className="text-3xl font-bold text-white">{stats?.totalMeetings || 0}</p>
              <p className="text-gray-400 text-sm">Total Meetings</p>
            </div>

            <div className="p-6 bg-gray-800 border border-gray-700 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Clock className="w-6 h-6 text-purple-400" />
                </div>
                <span className="text-green-400 text-sm font-medium">+8%</span>
              </div>
              <p className="text-3xl font-bold text-white">{stats?.totalMinutes || 0}</p>
              <p className="text-gray-400 text-sm">Minutes in Meetings</p>
            </div>

            <div className="p-6 bg-gray-800 border border-gray-700 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <Calendar className="w-6 h-6 text-orange-400" />
                </div>
              </div>
              <p className="text-3xl font-bold text-white">{stats?.upcomingMeetings || 0}</p>
              <p className="text-gray-400 text-sm">Upcoming Meetings</p>
            </div>

            <div className="p-6 bg-gray-800 border border-gray-700 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Play className="w-6 h-6 text-green-400" />
                </div>
              </div>
              <p className="text-3xl font-bold text-white">{stats?.recordings || 0}</p>
              <p className="text-gray-400 text-sm">Recordings</p>
            </div>
          </div>

          {/* Recent meetings */}
          <div className="bg-gray-800 border border-gray-700 rounded-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Recent Meetings</h2>
              <Link
                href="/dashboard/meetings"
                className="text-blue-400 hover:text-blue-300 text-sm font-medium flex items-center gap-1"
              >
                View all
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="divide-y divide-gray-700">
              {meetings.length > 0 ? (
                meetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="flex items-center justify-between p-4 hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`p-3 rounded-xl ${
                          meeting.status === 'live'
                            ? 'bg-green-500/20'
                            : meeting.status === 'scheduled'
                            ? 'bg-blue-500/20'
                            : 'bg-gray-700'
                        }`}
                      >
                        <Video
                          className={`w-5 h-5 ${
                            meeting.status === 'live'
                              ? 'text-green-400'
                              : meeting.status === 'scheduled'
                              ? 'text-blue-400'
                              : 'text-gray-400'
                          }`}
                        />
                      </div>
                      <div>
                        <h3 className="text-white font-medium">{meeting.title}</h3>
                        <div className="flex items-center gap-3 text-sm text-gray-400">
                          <span>{formatDate(meeting.scheduledAt)}</span>
                          <span>•</span>
                          <span>{formatTime(meeting.scheduledAt)}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {meeting.participantCount}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {meeting.status === 'live' && (
                        <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm font-medium rounded-full flex items-center gap-2">
                          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                          Live
                        </span>
                      )}

                      {meeting.hasRecording && (
                        <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-lg transition-colors">
                          <Play className="w-4 h-4" />
                        </button>
                      )}

                      {meeting.hasTranscript && (
                        <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-lg transition-colors">
                          <FileText className="w-4 h-4" />
                        </button>
                      )}

                      <Link
                        href={`/meeting/${meeting.id}`}
                        className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        {meeting.status === 'live' ? 'Join' : 'View'}
                      </Link>

                      <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <Video className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-white font-medium mb-2">No meetings yet</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Start your first meeting to get started
                  </p>
                  <button
                    onClick={handleCreateMeeting}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Meeting
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <JoinMeetingModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
      />
      <ScheduleMeetingModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
      />
    </div>
  );
}
