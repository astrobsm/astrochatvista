// ============================================================================
// CHATVISTA - Video Tile Component
// Individual video tile for participant in the meeting grid
// ============================================================================

'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Mic, MicOff, Hand, Crown, Pin, MoreVertical, Maximize } from 'lucide-react';

interface VideoTileProps {
  participantId: string;
  name: string;
  stream?: MediaStream;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isSpeaking?: boolean;
  isHandRaised?: boolean;
  isHost?: boolean;
  isPinned?: boolean;
  isScreenShare?: boolean;
  onPin?: () => void;
  onFullscreen?: () => void;
}

export function VideoTile({
  participantId,
  name,
  stream,
  isLocal = false,
  isMuted = false,
  isVideoOff = false,
  isSpeaking = false,
  isHandRaised = false,
  isHost = false,
  isPinned = false,
  isScreenShare = false,
  onPin,
  onFullscreen,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl bg-gray-900 aspect-video
        ${isSpeaking ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-gray-900' : ''}
        ${isPinned ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900' : ''}
        transition-all duration-200
      `}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Video or Avatar */}
      {!isVideoOff && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full object-cover ${isLocal && !isScreenShare ? 'transform -scale-x-100' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white">
            {initials}
          </div>
        </div>
      )}

      {/* Gradient overlay for better text visibility */}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />

      {/* Participant name and status */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Muted indicator */}
          <div className={`p-1 rounded ${isMuted ? 'bg-red-500/80' : 'bg-green-500/80'}`}>
            {isMuted ? (
              <MicOff className="w-3 h-3 text-white" />
            ) : (
              <Mic className="w-3 h-3 text-white" />
            )}
          </div>

          {/* Name */}
          <span className="text-white text-sm font-medium truncate max-w-[150px]">
            {name}
            {isLocal && ' (You)'}
          </span>

          {/* Host badge */}
          {isHost && (
            <div className="p-1 bg-yellow-500/80 rounded">
              <Crown className="w-3 h-3 text-white" />
            </div>
          )}
        </div>

        {/* Hand raised indicator */}
        {isHandRaised && (
          <div className="p-1.5 bg-yellow-500 rounded-full animate-bounce">
            <Hand className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* Hover controls */}
      {showControls && (
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {onPin && (
            <button
              onClick={onPin}
              className={`p-1.5 rounded-lg transition-colors ${
                isPinned ? 'bg-blue-500 text-white' : 'bg-black/50 text-white hover:bg-black/70'
              }`}
              title={isPinned ? 'Unpin' : 'Pin'}
            >
              <Pin className="w-4 h-4" />
            </button>
          )}

          {onFullscreen && (
            <button
              onClick={onFullscreen}
              className="p-1.5 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
              title="Fullscreen"
            >
              <Maximize className="w-4 h-4" />
            </button>
          )}

          <button
            className="p-1.5 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
            title="More options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Speaking indicator animation */}
      {isSpeaking && !isMuted && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-500 animate-pulse" />
      )}

      {/* Screen share label */}
      {isScreenShare && (
        <div className="absolute top-2 left-2 px-2 py-1 bg-blue-500 text-white text-xs font-medium rounded">
          Screen Share
        </div>
      )}

      {/* Local badge */}
      {isLocal && !isScreenShare && (
        <div className="absolute top-2 left-2 px-2 py-1 bg-gray-700/80 text-white text-xs font-medium rounded">
          You
        </div>
      )}
    </div>
  );
}
