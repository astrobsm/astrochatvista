'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, 
  MessageSquare, Users, Settings, MoreVertical,
  Hand, Smile, Share2, Circle, FileText, 
  ChevronUp, Maximize2, Grid, PanelRightOpen
} from 'lucide-react';
import { useMeetingStore } from '@/store/meeting';
import { useMediaDevices } from '@/hooks/useMediaDevices';
import { useWebRTC } from '@/hooks/useWebRTC';
import { VideoTile } from '@/components/meeting/VideoTile';
import { ChatPanel } from '@/components/meeting/ChatPanel';
import { ParticipantsPanel } from '@/components/meeting/ParticipantsPanel';
import { ControlButton } from '@/components/meeting/ControlButton';
import { TranscriptPanel } from '@/components/meeting/TranscriptPanel';

interface MeetingRoomProps {
  meetingId: string;
}

export default function MeetingRoom({ meetingId }: MeetingRoomProps) {
  const router = useRouter();

  const [sidePanel, setSidePanel] = useState<'chat' | 'participants' | 'transcript' | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  const {
    isConnected,
    isMuted,
    isVideoOff,
    isScreenSharing,
    isRecording,
    isHandRaised,
    participants,
    localStream,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    toggleRecording,
    toggleHandRaise,
    leaveMeeting,
  } = useMeetingStore();

  const { devices, selectedDevices, selectDevice, getMediaStream } = useMediaDevices();

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'm':
          toggleMute();
          break;
        case 'v':
          toggleVideo();
          break;
        case 'c':
          setSidePanel(sidePanel === 'chat' ? null : 'chat');
          break;
        case 'p':
          setSidePanel(sidePanel === 'participants' ? null : 'participants');
          break;
        case 'h':
          toggleHandRaise();
          break;
        case 'escape':
          if (isFullscreen) {
            document.exitFullscreen();
            setIsFullscreen(false);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidePanel, isFullscreen, toggleMute, toggleVideo, toggleHandRaise]);

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 5000);
  }, []);

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [resetControlsTimeout]);

  const handleLeaveMeeting = async () => {
    await leaveMeeting();
    router.push('/dashboard');
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const participantCount = participants.length + 1; // +1 for self

  return (
    <div 
      className="meeting-room"
      onMouseMove={resetControlsTimeout}
    >
      {/* Header */}
      <header className={`meeting-header transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center gap-4">
          <Image src="/logo.png" alt="ChatVista" width={32} height={32} className="h-8 w-8 rounded-lg" />
          <div>
            <h1 className="text-white font-medium">Team Standup</h1>
            <p className="text-sm text-gray-400">Meeting ID: {meetingId}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isRecording && (
            <div className="flex items-center gap-2 rounded-full bg-red-500/20 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm text-red-400">Recording</span>
            </div>
          )}
          
          <div className="flex items-center gap-2 text-gray-400">
            <Users className="h-4 w-4" />
            <span>{participantCount}</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 text-gray-400 hover:text-white transition"
          >
            <Maximize2 className="h-5 w-5" />
          </button>

          <button className="p-2 text-gray-400 hover:text-white transition">
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="meeting-content">
        {/* Video Grid */}
        <div className="flex-1 p-4">
          <div className="video-grid h-full" data-count={participantCount}>
            {/* Self Video */}
            <VideoTile
              participantId="local"
              stream={localStream || undefined}
              name="You"
              isMuted={isMuted}
              isVideoOff={isVideoOff}
              isLocal
              isHandRaised={isHandRaised}
            />

            {/* Remote Participants */}
            {participants.map((participant) => (
              <VideoTile
                key={participant.id}
                participantId={participant.id}
                stream={participant.stream}
                name={participant.name}
                isMuted={participant.isMuted}
                isVideoOff={participant.isVideoOff}
                isHandRaised={participant.isHandRaised}
                isSpeaking={participant.isSpeaking}
              />
            ))}
          </div>
        </div>

        {/* Side Panel */}
        {sidePanel && (
          <aside className="meeting-sidebar animate-slide-in">
            <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
              <h2 className="font-medium text-white capitalize">{sidePanel}</h2>
              <button
                onClick={() => setSidePanel(null)}
                className="p-1 text-gray-400 hover:text-white transition"
              >
                <PanelRightOpen className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden">
              {sidePanel === 'chat' && <ChatPanel meetingId={meetingId} />}
              {sidePanel === 'participants' && <ParticipantsPanel participants={participants} />}
              {sidePanel === 'transcript' && <TranscriptPanel meetingId={meetingId} />}
            </div>
          </aside>
        )}
      </main>

      {/* Controls */}
      <footer className={`meeting-controls transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        {/* Left Controls */}
        <div className="flex items-center gap-2">
          <ControlButton
            icon={isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            label={isMuted ? 'Unmute' : 'Mute'}
            variant={isMuted ? 'danger' : 'default'}
            onClick={toggleMute}
            shortcut="M"
          />
          
          <ControlButton
            icon={isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            label={isVideoOff ? 'Start Video' : 'Stop Video'}
            variant={isVideoOff ? 'danger' : 'default'}
            onClick={toggleVideo}
            shortcut="V"
          />

          <ControlButton
            icon={<Monitor className="h-5 w-5" />}
            label={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
            variant={isScreenSharing ? 'active' : 'default'}
            onClick={toggleScreenShare}
          />
        </div>

        {/* Center - Leave Button */}
        <ControlButton
          icon={<PhoneOff className="h-5 w-5" />}
          label="Leave"
          variant="danger"
          onClick={handleLeaveMeeting}
          className="px-6"
        />

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          <ControlButton
            icon={<Hand className="h-5 w-5" />}
            label={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
            variant={isHandRaised ? 'active' : 'default'}
            onClick={toggleHandRaise}
            shortcut="H"
          />

          <ControlButton
            icon={<Smile className="h-5 w-5" />}
            label="React"
            onClick={() => {}}
          />

          <ControlButton
            icon={<Circle className="h-5 w-5" />}
            label={isRecording ? 'Stop Recording' : 'Record'}
            variant={isRecording ? 'danger' : 'default'}
            onClick={toggleRecording}
          />

          <div className="mx-2 h-8 w-px bg-gray-700" />

          <ControlButton
            icon={<MessageSquare className="h-5 w-5" />}
            label="Chat"
            variant={sidePanel === 'chat' ? 'active' : 'default'}
            onClick={() => setSidePanel(sidePanel === 'chat' ? null : 'chat')}
            shortcut="C"
          />

          <ControlButton
            icon={<Users className="h-5 w-5" />}
            label="Participants"
            variant={sidePanel === 'participants' ? 'active' : 'default'}
            onClick={() => setSidePanel(sidePanel === 'participants' ? null : 'participants')}
            shortcut="P"
          />

          <ControlButton
            icon={<FileText className="h-5 w-5" />}
            label="Transcript"
            variant={sidePanel === 'transcript' ? 'active' : 'default'}
            onClick={() => setSidePanel(sidePanel === 'transcript' ? null : 'transcript')}
          />

          <ControlButton
            icon={<MoreVertical className="h-5 w-5" />}
            label="More"
            onClick={() => {}}
          />
        </div>
      </footer>
    </div>
  );
}
