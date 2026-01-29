// ============================================================================
// CHATVISTA - Meeting Store
// Zustand store for meeting state management
// ============================================================================

import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { Device } from 'mediasoup-client';

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  stream?: MediaStream;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  isSpeaking: boolean;
  role: 'HOST' | 'CO_HOST' | 'PARTICIPANT';
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'system';
}

interface TranscriptSegment {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  timestamp: number;
}

interface MeetingState {
  // Connection
  socket: Socket | null;
  device: Device | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  meetingId: string | null;

  // Local State
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  isHandRaised: boolean;

  // Remote State
  participants: Participant[];
  chatMessages: ChatMessage[];
  transcriptSegments: TranscriptSegment[];

  // Meeting Info
  meetingTitle: string;
  hostId: string | null;
  startTime: Date | null;
  
  // Actions
  joinMeeting: (meetingId: string, token: string) => Promise<void>;
  leaveMeeting: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => Promise<void>;
  toggleRecording: () => Promise<void>;
  toggleHandRaise: () => void;
  sendChatMessage: (content: string) => void;
  sendReaction: (emoji: string) => void;
  
  // Setters
  setLocalStream: (stream: MediaStream | null) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (participantId: string) => void;
  updateParticipant: (participantId: string, updates: Partial<Participant>) => void;
  addChatMessage: (message: ChatMessage) => void;
  addTranscriptSegment: (segment: TranscriptSegment) => void;
}

export const useMeetingStore = create<MeetingState>((set, get) => ({
  // Initial State
  socket: null,
  device: null,
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  meetingId: null,

  localStream: null,
  screenStream: null,
  isMuted: false,
  isVideoOff: false,
  isScreenSharing: false,
  isRecording: false,
  isHandRaised: false,

  participants: [],
  chatMessages: [],
  transcriptSegments: [],

  meetingTitle: '',
  hostId: null,
  startTime: null,

  // Actions
  joinMeeting: async (meetingId: string, token: string) => {
    set({ isConnecting: true, connectionError: null });

    try {
      // Create socket connection
      const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', {
        auth: { token },
        transports: ['websocket'],
      });

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        socket.on('connect', () => resolve());
        socket.on('connect_error', (err) => reject(err));
        setTimeout(() => reject(new Error('Connection timeout')), 10000);
      });

      // Create mediasoup device
      const device = new Device();

      // Get router capabilities
      socket.emit('get-rtp-capabilities', { meetingId }, async (data: any) => {
        if (data.error) {
          throw new Error(data.error);
        }

        await device.load({ routerRtpCapabilities: data.rtpCapabilities });
      });

      // Set up socket listeners
      setupSocketListeners(socket, set, get);

      // Join the room
      socket.emit('join-room', { meetingId }, (response: any) => {
        if (response.error) {
          set({ connectionError: response.error, isConnecting: false });
          return;
        }

        set({
          socket,
          device,
          meetingId,
          isConnected: true,
          isConnecting: false,
          meetingTitle: response.title,
          hostId: response.hostId,
          participants: response.participants || [],
        });
      });
    } catch (error) {
      set({
        connectionError: (error as Error).message,
        isConnecting: false,
      });
    }
  },

  leaveMeeting: async () => {
    const { socket, localStream, screenStream } = get();

    // Stop local streams
    localStream?.getTracks().forEach((track) => track.stop());
    screenStream?.getTracks().forEach((track) => track.stop());

    // Leave room and disconnect
    if (socket) {
      socket.emit('leave-room');
      socket.disconnect();
    }

    // Reset state
    set({
      socket: null,
      device: null,
      isConnected: false,
      meetingId: null,
      localStream: null,
      screenStream: null,
      participants: [],
      chatMessages: [],
      transcriptSegments: [],
      isMuted: false,
      isVideoOff: false,
      isScreenSharing: false,
      isRecording: false,
      isHandRaised: false,
    });
  },

  toggleMute: () => {
    const { localStream, socket, isMuted } = get();
    
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
    }

    socket?.emit('toggle-audio', { enabled: isMuted });
    set({ isMuted: !isMuted });
  },

  toggleVideo: () => {
    const { localStream, socket, isVideoOff } = get();
    
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isVideoOff;
      });
    }

    socket?.emit('toggle-video', { enabled: isVideoOff });
    set({ isVideoOff: !isVideoOff });
  },

  toggleScreenShare: async () => {
    const { socket, isScreenSharing, screenStream } = get();

    if (isScreenSharing) {
      // Stop screen sharing
      screenStream?.getTracks().forEach((track) => track.stop());
      socket?.emit('stop-screen-share');
      set({ isScreenSharing: false, screenStream: null });
    } else {
      try {
        // Start screen sharing
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });

        stream.getVideoTracks()[0].onended = () => {
          socket?.emit('stop-screen-share');
          set({ isScreenSharing: false, screenStream: null });
        };

        socket?.emit('start-screen-share');
        set({ isScreenSharing: true, screenStream: stream });
      } catch (error) {
        console.error('Failed to start screen share:', error);
      }
    }
  },

  toggleRecording: async () => {
    const { socket, isRecording, meetingId } = get();

    if (isRecording) {
      socket?.emit('stop-recording', { meetingId });
    } else {
      socket?.emit('start-recording', { meetingId });
    }

    set({ isRecording: !isRecording });
  },

  toggleHandRaise: () => {
    const { socket, isHandRaised } = get();
    socket?.emit('toggle-hand', { raised: !isHandRaised });
    set({ isHandRaised: !isHandRaised });
  },

  sendChatMessage: (content: string) => {
    const { socket, meetingId } = get();
    socket?.emit('chat-message', { meetingId, content });
  },

  sendReaction: (emoji: string) => {
    const { socket, meetingId } = get();
    socket?.emit('reaction', { meetingId, emoji });
  },

  // Setters
  setLocalStream: (stream) => set({ localStream: stream }),

  addParticipant: (participant) => {
    set((state) => ({
      participants: [...state.participants, participant],
    }));
  },

  removeParticipant: (participantId) => {
    set((state) => ({
      participants: state.participants.filter((p) => p.id !== participantId),
    }));
  },

  updateParticipant: (participantId, updates) => {
    set((state) => ({
      participants: state.participants.map((p) =>
        p.id === participantId ? { ...p, ...updates } : p
      ),
    }));
  },

  addChatMessage: (message) => {
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    }));
  },

  addTranscriptSegment: (segment) => {
    set((state) => ({
      transcriptSegments: [...state.transcriptSegments, segment],
    }));
  },
}));

// Socket event listeners
function setupSocketListeners(
  socket: Socket,
  set: any,
  get: () => MeetingState
) {
  socket.on('participant-joined', (data) => {
    get().addParticipant({
      id: data.id,
      name: data.name,
      avatar: data.avatar,
      isMuted: true,
      isVideoOff: true,
      isScreenSharing: false,
      isHandRaised: false,
      isSpeaking: false,
      role: data.role,
    });
  });

  socket.on('participant-left', (data) => {
    get().removeParticipant(data.id);
  });

  socket.on('participant-updated', (data) => {
    get().updateParticipant(data.id, data);
  });

  socket.on('chat-message', (data) => {
    get().addChatMessage({
      id: data.id,
      senderId: data.senderId,
      senderName: data.senderName,
      content: data.content,
      timestamp: new Date(data.timestamp),
      type: 'text',
    });
  });

  socket.on('transcript-segment', (data) => {
    get().addTranscriptSegment({
      id: data.id,
      speakerId: data.speakerId,
      speakerName: data.speakerName,
      text: data.text,
      timestamp: data.timestamp,
    });
  });

  socket.on('recording-started', () => {
    set({ isRecording: true });
  });

  socket.on('recording-stopped', () => {
    set({ isRecording: false });
  });

  socket.on('hand-raised', (data) => {
    get().updateParticipant(data.participantId, { isHandRaised: true });
  });

  socket.on('hand-lowered', (data) => {
    get().updateParticipant(data.participantId, { isHandRaised: false });
  });

  socket.on('reaction', (data) => {
    // Handle reaction display
    console.log('Reaction:', data);
  });

  socket.on('disconnect', () => {
    set({ isConnected: false });
  });
}
