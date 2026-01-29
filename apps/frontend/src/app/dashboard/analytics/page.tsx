// ============================================================================
// CHATVISTA - Analytics Page
// Meeting analytics and insights dashboard
// ============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart2,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Video,
  Calendar,
  FileText,
  Mic,
  Download,
  ChevronDown,
} from 'lucide-react';
import { api } from '@/lib/api';

interface AnalyticsData {
  overview: {
    totalMeetings: number;
    totalMinutes: number;
    totalParticipants: number;
    totalRecordings: number;
    meetingsChange: number;
    minutesChange: number;
    participantsChange: number;
  };
  meetingsByDay: Array<{ date: string; count: number }>;
  meetingsByType: Array<{ type: string; count: number; percentage: number }>;
  topParticipants: Array<{ name: string; email: string; meetings: number; minutes: number }>;
  peakHours: Array<{ hour: number; count: number }>;
  averageDuration: number;
  averageParticipants: number;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const analytics = await api.analytics.getDashboard();
      setData(analytics);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      // Mock data for demonstration
      setData({
        overview: {
          totalMeetings: 47,
          totalMinutes: 2340,
          totalParticipants: 156,
          totalRecordings: 23,
          meetingsChange: 12,
          minutesChange: 8,
          participantsChange: -3,
        },
        meetingsByDay: [
          { date: '2026-01-23', count: 5 },
          { date: '2026-01-24', count: 8 },
          { date: '2026-01-25', count: 3 },
          { date: '2026-01-26', count: 7 },
          { date: '2026-01-27', count: 12 },
          { date: '2026-01-28', count: 6 },
          { date: '2026-01-29', count: 6 },
        ],
        meetingsByType: [
          { type: 'Team Standup', count: 20, percentage: 42 },
          { type: 'Client Call', count: 12, percentage: 26 },
          { type: '1:1 Meeting', count: 10, percentage: 21 },
          { type: 'All Hands', count: 5, percentage: 11 },
        ],
        topParticipants: [
          { name: 'John Doe', email: 'john@example.com', meetings: 32, minutes: 1240 },
          { name: 'Jane Smith', email: 'jane@example.com', meetings: 28, minutes: 980 },
          { name: 'Mike Johnson', email: 'mike@example.com', meetings: 24, minutes: 720 },
          { name: 'Sarah Wilson', email: 'sarah@example.com', meetings: 20, minutes: 640 },
          { name: 'Alex Brown', email: 'alex@example.com', meetings: 18, minutes: 580 },
        ],
        peakHours: [
          { hour: 9, count: 12 },
          { hour: 10, count: 18 },
          { hour: 11, count: 15 },
          { hour: 14, count: 20 },
          { hour: 15, count: 16 },
          { hour: 16, count: 10 },
        ],
        averageDuration: 45,
        averageParticipants: 4.2,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!data) return null;

  const maxMeetings = Math.max(...data.meetingsByDay.map((d) => d.count));

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Analytics</h1>
              <p className="text-gray-400">Track your meeting activity and insights</p>
            </div>

            <div className="flex items-center gap-4">
              {/* Date range selector */}
              <div className="relative">
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as any)}
                  className="appearance-none px-4 py-2 pr-10 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white hover:bg-gray-700 transition-colors">
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Overview stats */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          {[
            {
              label: 'Total Meetings',
              value: data.overview.totalMeetings,
              change: data.overview.meetingsChange,
              icon: Video,
              color: 'blue',
            },
            {
              label: 'Total Minutes',
              value: formatDuration(data.overview.totalMinutes),
              change: data.overview.minutesChange,
              icon: Clock,
              color: 'purple',
            },
            {
              label: 'Participants',
              value: data.overview.totalParticipants,
              change: data.overview.participantsChange,
              icon: Users,
              color: 'green',
            },
            {
              label: 'Recordings',
              value: data.overview.totalRecordings,
              icon: FileText,
              color: 'orange',
            },
          ].map((stat, index) => (
            <div
              key={index}
              className="bg-gray-800 border border-gray-700 rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg bg-${stat.color}-500/20`}>
                  <stat.icon className={`w-6 h-6 text-${stat.color}-400`} />
                </div>
                {stat.change !== undefined && (
                  <div
                    className={`flex items-center gap-1 text-sm font-medium ${
                      stat.change >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {stat.change >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    {Math.abs(stat.change)}%
                  </div>
                )}
              </div>
              <p className="text-3xl font-bold text-white">{stat.value}</p>
              <p className="text-gray-400 text-sm">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Meetings over time */}
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Meetings Over Time</h3>
            <div className="flex items-end gap-2 h-48">
              {data.meetingsByDay.map((day, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-400"
                    style={{ height: `${(day.count / maxMeetings) * 100}%` }}
                  />
                  <span className="text-xs text-gray-500">
                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Meeting types */}
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Meeting Types</h3>
            <div className="space-y-4">
              {data.meetingsByType.map((type, index) => {
                const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500'];
                return (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white">{type.type}</span>
                      <span className="text-gray-400">{type.count} meetings</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colors[index % colors.length]} rounded-full transition-all`}
                        style={{ width: `${type.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-3 gap-6">
          {/* Peak hours */}
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Peak Hours</h3>
            <div className="space-y-3">
              {data.peakHours
                .sort((a, b) => b.count - a.count)
                .slice(0, 5)
                .map((hour, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-gray-400 w-16">
                      {hour.hour.toString().padStart(2, '0')}:00
                    </span>
                    <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${(hour.count / Math.max(...data.peakHours.map((h) => h.count))) * 100}%` }}
                      />
                    </div>
                    <span className="text-white w-8 text-right">{hour.count}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Top participants */}
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 col-span-2">
            <h3 className="text-lg font-semibold text-white mb-6">Top Participants</h3>
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm">
                  <th className="pb-4">Name</th>
                  <th className="pb-4">Meetings</th>
                  <th className="pb-4">Time Spent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {data.topParticipants.map((participant, index) => (
                  <tr key={index}>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
                          {participant.name[0]}
                        </div>
                        <div>
                          <p className="text-white font-medium">{participant.name}</p>
                          <p className="text-gray-400 text-sm">{participant.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-white">{participant.meetings}</td>
                    <td className="py-3 text-white">{formatDuration(participant.minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick stats */}
        <div className="mt-8 grid grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-2xl p-6">
            <h3 className="text-gray-400 text-sm mb-2">Average Meeting Duration</h3>
            <p className="text-4xl font-bold text-white">{data.averageDuration} min</p>
            <p className="text-gray-400 text-sm mt-2">
              Your meetings average {data.averageDuration} minutes in length
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-500/20 to-teal-500/20 border border-green-500/30 rounded-2xl p-6">
            <h3 className="text-gray-400 text-sm mb-2">Average Participants</h3>
            <p className="text-4xl font-bold text-white">{data.averageParticipants}</p>
            <p className="text-gray-400 text-sm mt-2">
              Your meetings average {data.averageParticipants} participants
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
