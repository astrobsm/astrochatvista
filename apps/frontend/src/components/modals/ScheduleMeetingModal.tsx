// ============================================================================
// CHATVISTA - Schedule Meeting Modal
// Modal for scheduling a future meeting
// ============================================================================

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Clock,
  Users,
  Video,
  Loader2,
  Plus,
  X,
  Mail,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';

interface ScheduleMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (meeting: any) => void;
}

export function ScheduleMeetingModal({
  isOpen,
  onClose,
  onSuccess,
}: ScheduleMeetingModalProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [createdMeeting, setCreatedMeeting] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    duration: 60,
    invitees: [] as string[],
  });
  const [newInvitee, setNewInvitee] = useState('');

  const handleAddInvitee = () => {
    if (newInvitee && !formData.invitees.includes(newInvitee)) {
      setFormData({
        ...formData,
        invitees: [...formData.invitees, newInvitee],
      });
      setNewInvitee('');
    }
  };

  const handleRemoveInvitee = (email: string) => {
    setFormData({
      ...formData,
      invitees: formData.invitees.filter((e) => e !== email),
    });
  };

  const handleCreate = async () => {
    if (!formData.title.trim()) {
      setError('Please enter a meeting title');
      return;
    }

    if (!formData.date || !formData.time) {
      setError('Please select a date and time');
      return;
    }

    setError('');
    setIsCreating(true);

    try {
      const scheduledStartTime = new Date(`${formData.date}T${formData.time}`);

      const meeting = await api.meetings.create({
        title: formData.title,
        description: formData.description,
        scheduledStartTime,
      });

      // Invite participants if any
      if (formData.invitees.length > 0) {
        await api.meetings.inviteParticipants(meeting.id, formData.invitees);
      }

      setCreatedMeeting(meeting);
      onSuccess?.(meeting);
    } catch (err) {
      setError('Failed to create meeting. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = async () => {
    if (createdMeeting) {
      const link = `${window.location.origin}/meeting/${createdMeeting.id}`;
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setFormData({
      title: '',
      description: '',
      date: '',
      time: '',
      duration: 60,
      invitees: [],
    });
    setCreatedMeeting(null);
    setError('');
    onClose();
  };

  // Success state
  if (createdMeeting) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Meeting Scheduled!"
        size="md"
      >
        <div className="space-y-6">
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              {createdMeeting.title}
            </h3>
            <p className="text-gray-400">
              {new Date(createdMeeting.scheduledAt).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          <div className="bg-gray-700/50 rounded-xl p-4">
            <label className="text-sm font-medium text-gray-300 mb-2 block">
              Meeting Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={`${window.location.origin}/meeting/${createdMeeting.id}`}
                readOnly
                className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm"
              />
              <button
                onClick={handleCopyLink}
                className={`p-2 rounded-lg transition-colors ${
                  copied ? 'bg-green-500 text-white' : 'bg-gray-600 text-white hover:bg-gray-500'
                }`}
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {formData.invitees.length > 0 && (
            <div className="bg-gray-700/50 rounded-xl p-4">
              <p className="text-sm text-gray-300">
                <Mail className="w-4 h-4 inline mr-2" />
                Invitations sent to {formData.invitees.length} participant(s)
              </p>
            </div>
          )}
        </div>

        <ModalFooter>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button
            onClick={() => router.push(`/meeting/${createdMeeting.id}`)}
            leftIcon={Video}
          >
            Start Now
          </Button>
        </ModalFooter>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Schedule a Meeting"
      description="Set up a meeting for later"
      size="lg"
    >
      <div className="space-y-6">
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <Input
          label="Meeting Title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Weekly Team Standup"
          leftIcon={Video}
        />

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description (Optional)
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Add meeting agenda or notes..."
            rows={3}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            min={new Date().toISOString().split('T')[0]}
          />

          <Input
            label="Time"
            type="time"
            value={formData.time}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
          />

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Duration
            </label>
            <select
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
            </select>
          </div>
        </div>

        {/* Invitees */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Invite Participants (Optional)
          </label>
          <div className="flex gap-2 mb-3">
            <div className="flex-1 relative">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={newInvitee}
                onChange={(e) => setNewInvitee(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddInvitee())}
                placeholder="Enter email address"
                className="w-full pl-12 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button onClick={handleAddInvitee} leftIcon={Plus}>
              Add
            </Button>
          </div>

          {formData.invitees.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.invitees.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-700 text-white text-sm rounded-full"
                >
                  {email}
                  <button
                    onClick={() => handleRemoveInvitee(email)}
                    className="p-0.5 hover:bg-gray-600 rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          onClick={handleCreate}
          isLoading={isCreating}
          leftIcon={Calendar}
        >
          Schedule Meeting
        </Button>
      </ModalFooter>
    </Modal>
  );
}
