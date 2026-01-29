// ============================================================================
// CHATVISTA - Profile Page
// User profile management
// ============================================================================

'use client';

import React, { useState, useRef } from 'react';
import {
  User,
  Mail,
  Shield,
  Camera,
  Key,
  Smartphone,
  Bell,
  Globe,
  Loader2,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    timezone: 'America/New_York',
    language: 'en',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      await api.users.updateProfile({
        name: formData.name,
      });
      
      refreshUser?.();
      setIsEditing(false);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      await api.users.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });

      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setMessage({ type: 'success', text: 'Password changed successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to change password. Check your current password.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      await api.users.uploadAvatar(formData);
      refreshUser?.();
      setMessage({ type: 'success', text: 'Avatar updated!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to upload avatar' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700">
        <div className="max-w-4xl mx-auto px-8 py-6">
          <h1 className="text-2xl font-bold text-white">Profile</h1>
          <p className="text-gray-400">Manage your account settings and preferences</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-8 py-8 space-y-8">
        {/* Message */}
        {message && (
          <div
            className={`flex items-center gap-3 p-4 rounded-xl ${
              message.type === 'success'
                ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}
          >
            {message.type === 'success' ? (
              <Check className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span>{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="ml-auto p-1 hover:bg-white/10 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Avatar Section */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl font-bold text-white overflow-hidden">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user?.name?.[0] || 'U'
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white hover:bg-blue-600 transition-colors"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{user?.name}</h2>
              <p className="text-gray-400">{user?.email}</p>
              <p className="text-sm text-gray-500 mt-1">
                Member since {new Date(user?.createdAt || Date.now()).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Profile Information */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <User className="w-5 h-5 text-blue-400" />
              Profile Information
            </h3>
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} variant="secondary">
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={() => setIsEditing(false)}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveProfile} isLoading={isSaving}>
                  Save
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Input
              label="Full Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={!isEditing}
              leftIcon={User}
            />
            <Input
              label="Email Address"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={true}
              leftIcon={Mail}
            />
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Timezone
              </label>
              <select
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                disabled={!isEditing}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="Europe/London">London (GMT)</option>
                <option value="Europe/Paris">Paris (CET)</option>
                <option value="Asia/Tokyo">Tokyo (JST)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Language
              </label>
              <select
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                disabled={!isEditing}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="ja">日本語</option>
                <option value="zh">中文</option>
              </select>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">
            <Shield className="w-5 h-5 text-green-400" />
            Security
          </h3>

          {/* Password Change */}
          <div className="space-y-4 mb-6">
            <h4 className="text-white font-medium">Change Password</h4>
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Current Password"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, currentPassword: e.target.value })
                }
                leftIcon={Key}
              />
              <Input
                label="New Password"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, newPassword: e.target.value })
                }
                leftIcon={Key}
              />
              <Input
                label="Confirm Password"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                }
                leftIcon={Key}
              />
            </div>
            <Button
              onClick={handleChangePassword}
              variant="secondary"
              disabled={!passwordData.currentPassword || !passwordData.newPassword}
            >
              Update Password
            </Button>
          </div>

          {/* MFA */}
          <div className="pt-6 border-t border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  Two-Factor Authentication
                </h4>
                <p className="text-gray-400 text-sm mt-1">
                  Add an extra layer of security to your account
                </p>
              </div>
              <div className="flex items-center gap-2">
                {user?.mfaEnabled ? (
                  <>
                    <span className="text-green-400 text-sm">Enabled</span>
                    <Button variant="secondary" size="sm">
                      Disable
                    </Button>
                  </>
                ) : (
                  <Button size="sm">Enable 2FA</Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-red-400 mb-4">Danger Zone</h3>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-white font-medium">Delete Account</h4>
              <p className="text-gray-400 text-sm">
                Permanently delete your account and all associated data
              </p>
            </div>
            <Button variant="destructive">Delete Account</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
