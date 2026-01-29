// ============================================================================
// CHATVISTA - Participants Panel Component
// Panel showing all meeting participants with their status
// ============================================================================

'use client';

import React, { useState } from 'react';
import {
  X,
  Search,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Hand,
  Crown,
  MoreVertical,
  UserMinus,
  Volume2,
  VolumeX,
  Pin,
} from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isHandRaised: boolean;
  isHost?: boolean;
  isSpeaking?: boolean;
  joinedAt?: Date;
  role?: 'HOST' | 'CO_HOST' | 'PARTICIPANT';
}

interface ParticipantsPanelProps {
  participants: Participant[];
  currentUserId?: string;
  isHost?: boolean;
  onClose?: () => void;
  onMuteParticipant?: (participantId: string) => void;
  onRemoveParticipant?: (participantId: string) => void;
  onMakeHost?: (participantId: string) => void;
  onPinParticipant?: (participantId: string) => void;
}

export function ParticipantsPanel({
  participants,
  currentUserId = '',
  isHost = false,
  onClose,
  onMuteParticipant,
  onRemoveParticipant,
  onMakeHost,
  onPinParticipant,
}: ParticipantsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);

  const filteredParticipants = participants.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort: Host first, then hand raised, then alphabetically
  const sortedParticipants = [...filteredParticipants].sort((a, b) => {
    const aIsHost = a.isHost || a.role === 'HOST';
    const bIsHost = b.isHost || b.role === 'HOST';
    if (aIsHost && !bIsHost) return -1;
    if (!aIsHost && bIsHost) return 1;
    if (a.isHandRaised && !b.isHandRaised) return -1;
    if (!a.isHandRaised && b.isHandRaised) return 1;
    return a.name.localeCompare(b.name);
  });

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="flex flex-col h-full bg-gray-900/95 backdrop-blur border-l border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div>
          <h2 className="text-lg font-semibold text-white">Participants</h2>
          <p className="text-sm text-gray-400">{participants.length} in meeting</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search participants..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Participants list */}
      <div className="flex-1 overflow-y-auto">
        {/* Hands raised section */}
        {sortedParticipants.some((p) => p.isHandRaised) && (
          <div className="p-3 bg-yellow-500/10 border-b border-yellow-500/20">
            <h3 className="text-sm font-medium text-yellow-400 mb-2 flex items-center gap-2">
              <Hand className="w-4 h-4" />
              Hands Raised
            </h3>
            <div className="space-y-2">
              {sortedParticipants
                .filter((p) => p.isHandRaised)
                .map((participant) => (
                  <ParticipantItem
                    key={participant.id}
                    participant={participant}
                    currentUserId={currentUserId}
                    isHostUser={isHost}
                    isSelected={selectedParticipant === participant.id}
                    onSelect={() =>
                      setSelectedParticipant(
                        selectedParticipant === participant.id ? null : participant.id
                      )
                    }
                    onMute={onMuteParticipant}
                    onRemove={onRemoveParticipant}
                    onMakeHost={onMakeHost}
                    onPin={onPinParticipant}
                  />
                ))}
            </div>
          </div>
        )}

        {/* All participants */}
        <div className="p-3 space-y-2">
          {sortedParticipants
            .filter((p) => !p.isHandRaised || !sortedParticipants.some((sp) => sp.isHandRaised))
            .map((participant) => (
              <ParticipantItem
                key={participant.id}
                participant={participant}
                currentUserId={currentUserId}
                isHostUser={isHost}
                isSelected={selectedParticipant === participant.id}
                onSelect={() =>
                  setSelectedParticipant(
                    selectedParticipant === participant.id ? null : participant.id
                  )
                }
                onMute={onMuteParticipant}
                onRemove={onRemoveParticipant}
                onMakeHost={onMakeHost}
                onPin={onPinParticipant}
              />
            ))}
        </div>

        {filteredParticipants.length === 0 && (
          <div className="p-4 text-center text-gray-500">
            No participants found
          </div>
        )}
      </div>

      {/* Actions footer */}
      {isHost && (
        <div className="p-4 border-t border-gray-700 space-y-2">
          <button className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm">
            Mute All Participants
          </button>
          <button className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm">
            Lower All Hands
          </button>
        </div>
      )}
    </div>
  );
}

// Individual participant item
function ParticipantItem({
  participant,
  currentUserId,
  isHostUser,
  isSelected,
  onSelect,
  onMute,
  onRemove,
  onMakeHost,
  onPin,
}: {
  participant: Participant;
  currentUserId: string;
  isHostUser: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onMute?: (id: string) => void;
  onRemove?: (id: string) => void;
  onMakeHost?: (id: string) => void;
  onPin?: (id: string) => void;
}) {
  const isCurrentUser = participant.id === currentUserId;

  return (
    <div
      className={`
        flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer
        ${isSelected ? 'bg-gray-700' : 'hover:bg-gray-800'}
        ${participant.isSpeaking ? 'ring-2 ring-green-500' : ''}
      `}
      onClick={onSelect}
    >
      {/* Avatar */}
      <div
        className={`
          w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white
          ${participant.isHost
            ? 'bg-gradient-to-br from-yellow-500 to-orange-600'
            : 'bg-gradient-to-br from-blue-500 to-purple-600'
          }
        `}
      >
        {participant.avatar ? (
          <img
            src={participant.avatar}
            alt={participant.name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          participant.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-medium truncate">
            {participant.name}
            {isCurrentUser && ' (You)'}
          </span>
          {participant.isHost && (
            <Crown className="w-4 h-4 text-yellow-500" />
          )}
        </div>
        {participant.email && (
          <span className="text-gray-400 text-xs truncate block">
            {participant.email}
          </span>
        )}
      </div>

      {/* Status indicators */}
      <div className="flex items-center gap-1">
        {participant.isHandRaised && (
          <div className="p-1 bg-yellow-500/20 rounded">
            <Hand className="w-4 h-4 text-yellow-500" />
          </div>
        )}

        <div className={`p-1 rounded ${participant.isMuted ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
          {participant.isMuted ? (
            <MicOff className="w-4 h-4 text-red-400" />
          ) : (
            <Mic className="w-4 h-4 text-green-400" />
          )}
        </div>

        <div className={`p-1 rounded ${participant.isVideoOff ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
          {participant.isVideoOff ? (
            <VideoOff className="w-4 h-4 text-red-400" />
          ) : (
            <Video className="w-4 h-4 text-green-400" />
          )}
        </div>
      </div>

      {/* More actions (for host) */}
      {isHostUser && !isCurrentUser && (
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-600 rounded transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {isSelected && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMute?.(participant.id);
                }}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-2"
              >
                {participant.isMuted ? (
                  <>
                    <Volume2 className="w-4 h-4" />
                    Ask to Unmute
                  </>
                ) : (
                  <>
                    <VolumeX className="w-4 h-4" />
                    Mute
                  </>
                )}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPin?.(participant.id);
                }}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-2"
              >
                <Pin className="w-4 h-4" />
                Pin Video
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMakeHost?.(participant.id);
                }}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-2"
              >
                <Crown className="w-4 h-4" />
                Make Host
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove?.(participant.id);
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2"
              >
                <UserMinus className="w-4 h-4" />
                Remove from Meeting
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
