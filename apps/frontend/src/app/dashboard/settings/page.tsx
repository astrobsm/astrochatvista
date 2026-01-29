// ============================================================================
// CHATVISTA - Settings Page
// User settings and preferences
// ============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Video,
  User,
  Bell,
  Shield,
  Palette,
  Mic,
  Camera,
  Monitor,
  ChevronLeft,
  Save,
  Loader2,
  Check,
  Key,
  Smartphone,
  LogOut,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';

type SettingsTab = 'profile' | 'audio-video' | 'notifications' | 'security' | 'appearance';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Profile form
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    avatar: '',
  });

  // Audio/Video settings
  const [avSettings, setAvSettings] = useState({
    defaultMicrophone: '',
    defaultCamera: '',
    defaultSpeaker: '',
    mirrorVideo: true,
    noiseSuppression: true,
    autoGainControl: true,
  });

  // Notification settings
  const [notifications, setNotifications] = useState({
    emailMeetingReminders: true,
    emailMeetingRecap: true,
    pushMeetingStart: true,
    pushChatMessages: true,
    soundEffects: true,
  });

  // Security settings
  const [security, setSecurity] = useState({
    mfaEnabled: false,
    sessions: [] as any[],
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const userData = await api.auth.getProfile();
      setUser(userData);
      setProfile({
        name: userData.name || '',
        email: userData.email || '',
        avatar: userData.avatar || '',
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await api.auth.updateProfile({
        name: profile.name,
        avatar: profile.avatar,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'audio-video', label: 'Audio & Video', icon: Camera },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'appearance', label: 'Appearance', icon: Palette },
  ] as const;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center gap-4">
          <Link
            href="/dashboard"
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-white">Settings</h1>
            <p className="text-sm text-gray-400">Manage your account settings and preferences</p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left
                    ${activeTab === tab.id
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'text-gray-300 hover:bg-gray-800'
                    }
                  `}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <main className="flex-1">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                  <h2 className="text-lg font-semibold text-white mb-6">Profile Information</h2>

                  <div className="flex items-start gap-6 mb-6">
                    <Avatar src={profile.avatar} name={profile.name || 'User'} size="xl" />
                    <div>
                      <Button variant="secondary" size="sm">
                        Change Avatar
                      </Button>
                      <p className="text-sm text-gray-400 mt-2">
                        JPG, PNG or GIF. Max 5MB.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Full Name"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      leftIcon={User}
                    />
                    <Input
                      label="Email Address"
                      value={profile.email}
                      disabled
                      leftIcon={User}
                      hint="Contact support to change email"
                    />
                  </div>

                  <div className="flex justify-end mt-6">
                    <Button
                      onClick={handleSaveProfile}
                      isLoading={isSaving}
                      leftIcon={saved ? Check : Save}
                    >
                      {saved ? 'Saved!' : 'Save Changes'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Audio & Video Tab */}
            {activeTab === 'audio-video' && (
              <div className="space-y-6">
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                  <h2 className="text-lg font-semibold text-white mb-6">Audio Settings</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Microphone
                      </label>
                      <select className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option>Default Microphone</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Speaker
                      </label>
                      <select className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option>Default Speaker</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-white font-medium">Noise Suppression</p>
                        <p className="text-sm text-gray-400">Reduce background noise</p>
                      </div>
                      <button
                        onClick={() => setAvSettings({ ...avSettings, noiseSuppression: !avSettings.noiseSuppression })}
                        className={`w-12 h-6 rounded-full transition-colors ${
                          avSettings.noiseSuppression ? 'bg-blue-500' : 'bg-gray-600'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                            avSettings.noiseSuppression ? 'translate-x-6' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                  <h2 className="text-lg font-semibold text-white mb-6">Video Settings</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Camera
                      </label>
                      <select className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option>Default Camera</option>
                      </select>
                    </div>

                    <div className="aspect-video bg-gray-900 rounded-xl flex items-center justify-center">
                      <p className="text-gray-500">Camera preview</p>
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-white font-medium">Mirror Video</p>
                        <p className="text-sm text-gray-400">Flip your video horizontally</p>
                      </div>
                      <button
                        onClick={() => setAvSettings({ ...avSettings, mirrorVideo: !avSettings.mirrorVideo })}
                        className={`w-12 h-6 rounded-full transition-colors ${
                          avSettings.mirrorVideo ? 'bg-blue-500' : 'bg-gray-600'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                            avSettings.mirrorVideo ? 'translate-x-6' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-6">Notification Preferences</h2>

                <div className="space-y-4">
                  {[
                    { key: 'emailMeetingReminders', label: 'Email Meeting Reminders', desc: 'Get reminded about upcoming meetings' },
                    { key: 'emailMeetingRecap', label: 'Meeting Recap Emails', desc: 'Receive summaries after meetings' },
                    { key: 'pushMeetingStart', label: 'Meeting Start Notifications', desc: 'Browser notifications when meetings start' },
                    { key: 'pushChatMessages', label: 'Chat Notifications', desc: 'Notifications for new chat messages' },
                    { key: 'soundEffects', label: 'Sound Effects', desc: 'Play sounds for join/leave events' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-700 last:border-0">
                      <div>
                        <p className="text-white font-medium">{item.label}</p>
                        <p className="text-sm text-gray-400">{item.desc}</p>
                      </div>
                      <button
                        onClick={() => setNotifications({ ...notifications, [item.key]: !notifications[item.key as keyof typeof notifications] })}
                        className={`w-12 h-6 rounded-full transition-colors ${
                          notifications[item.key as keyof typeof notifications] ? 'bg-blue-500' : 'bg-gray-600'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                            notifications[item.key as keyof typeof notifications] ? 'translate-x-6' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                  <h2 className="text-lg font-semibold text-white mb-6">Password</h2>

                  <div className="space-y-4">
                    <Input
                      label="Current Password"
                      type="password"
                      leftIcon={Key}
                    />
                    <Input
                      label="New Password"
                      type="password"
                      leftIcon={Key}
                    />
                    <Input
                      label="Confirm New Password"
                      type="password"
                      leftIcon={Key}
                    />
                    <Button>Update Password</Button>
                  </div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-lg font-semibold text-white">Two-Factor Authentication</h2>
                      <p className="text-sm text-gray-400">Add an extra layer of security</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      security.mfaEnabled ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {security.mfaEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>

                  <Button variant="secondary" leftIcon={Smartphone}>
                    {security.mfaEnabled ? 'Manage 2FA' : 'Enable 2FA'}
                  </Button>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                  <h2 className="text-lg font-semibold text-white mb-6">Active Sessions</h2>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-900 rounded-xl">
                      <div className="flex items-center gap-4">
                        <Monitor className="w-8 h-8 text-gray-400" />
                        <div>
                          <p className="text-white font-medium">Current Session</p>
                          <p className="text-sm text-gray-400">Windows • Chrome • Just now</p>
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded">
                        Active
                      </span>
                    </div>
                  </div>

                  <Button variant="outline" className="mt-4" leftIcon={LogOut}>
                    Sign Out All Other Sessions
                  </Button>
                </div>
              </div>
            )}

            {/* Appearance Tab */}
            {activeTab === 'appearance' && (
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-6">Appearance</h2>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-4">
                      Theme
                    </label>
                    <div className="grid grid-cols-3 gap-4">
                      {['Dark', 'Light', 'System'].map((theme) => (
                        <button
                          key={theme}
                          className={`p-4 rounded-xl border-2 transition-colors ${
                            theme === 'Dark'
                              ? 'border-blue-500 bg-gray-900'
                              : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                          }`}
                        >
                          <div className={`w-full h-20 rounded-lg mb-2 ${
                            theme === 'Light' ? 'bg-white' : 'bg-gray-800'
                          }`} />
                          <span className="text-white font-medium">{theme}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
