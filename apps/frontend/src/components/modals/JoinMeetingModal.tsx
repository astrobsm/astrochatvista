// ============================================================================
// CHATVISTA - Join Meeting Modal
// Modal for joining a meeting by code or link
// ============================================================================

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, Video, Loader2, AlertCircle } from 'lucide-react';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';

interface JoinMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function JoinMeetingModal({ isOpen, onClose }: JoinMeetingModalProps) {
  const router = useRouter();
  const [meetingCode, setMeetingCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  const extractMeetingId = (input: string): string => {
    // Handle full URL
    if (input.includes('/meeting/')) {
      const match = input.match(/\/meeting\/([a-zA-Z0-9-]+)/);
      if (match) return match[1];
    }
    
    // Handle meeting code with dashes (e.g., abc-defg-hij)
    if (input.match(/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i)) {
      return input.toLowerCase().replace(/-/g, '');
    }
    
    // Return as-is (UUID or other format)
    return input.trim();
  };

  const handleJoin = async () => {
    if (!meetingCode.trim()) {
      setError('Please enter a meeting code or link');
      return;
    }

    setError('');
    setIsJoining(true);

    try {
      const meetingId = extractMeetingId(meetingCode);
      
      // Validate meeting exists
      await api.meetings.get(meetingId);
      
      // Navigate to meeting
      router.push(`/meeting/${meetingId}`);
      onClose();
    } catch (err: any) {
      if (err.status === 404) {
        setError('Meeting not found. Please check the code and try again.');
      } else {
        setError('Unable to join meeting. Please try again.');
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && meetingCode.trim()) {
      handleJoin();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Join a Meeting"
      description="Enter the meeting code or link to join"
      size="md"
    >
      <div className="space-y-6">
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <Input
            label="Meeting Code or Link"
            value={meetingCode}
            onChange={(e) => setMeetingCode(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter code like abc-defg-hij or paste a link"
            leftIcon={Link2}
            autoFocus
          />

          <Input
            label="Your Name (Optional)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How you want to appear in the meeting"
            leftIcon={Video}
          />
        </div>

        <div className="bg-gray-700/50 rounded-xl p-4">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Before joining:</h4>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>• Make sure your camera and microphone are working</li>
            <li>• You'll have a chance to preview before joining</li>
            <li>• The host may need to admit you from the waiting room</li>
          </ul>
        </div>
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleJoin}
          isLoading={isJoining}
          disabled={!meetingCode.trim()}
          leftIcon={Video}
        >
          Join Meeting
        </Button>
      </ModalFooter>
    </Modal>
  );
}
