// ============================================================================
// CHATVISTA - Socket.IO Event Handlers
// ============================================================================

import { Server as SocketIOServer, Socket } from 'socket.io';
import { MediaServer } from '../media/MediaServer';
import { AuthService } from '../services/AuthService';
import { redisSub } from '../lib/redis';
import { logger } from '../utils/logger';

const authService = new AuthService();

interface AuthenticatedSocket extends Socket {
  userId: string;
  email: string;
  displayName: string;
  organizationId: string;
  roomId?: string;
  peerId?: string;
}

export function initializeSocketHandlers(io: SocketIOServer, mediaServer: MediaServer): void {
  // Subscribe to Redis pub/sub for cross-server communication
  if (redisSub) {
    redisSub.subscribe('meeting:events', (err) => {
      if (err) logger.error('Redis subscription error:', err);
    });

    redisSub.on('message', (channel, message) => {
      if (channel === 'meeting:events') {
        try {
          const event = JSON.parse(message);
          handleRedisEvent(io, event);
        } catch (error) {
          logger.error('Error parsing Redis event:', error);
        }
      }
    });
  }

  // Authentication middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const payload = await authService.verifyAccessToken(token as string);
      
      (socket as AuthenticatedSocket).userId = payload.sub;
      (socket as AuthenticatedSocket).email = payload.email;
      (socket as AuthenticatedSocket).organizationId = payload.organizationId;
      
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    logger.info(`Socket connected: ${socket.id} (User: ${authSocket.userId})`);

    // ========================================================================
    // ROOM MANAGEMENT
    // ========================================================================

    socket.on('join-room', async (data, callback) => {
      try {
        const { roomId, displayName } = data;
        
        authSocket.roomId = roomId;
        authSocket.displayName = displayName;
        authSocket.peerId = socket.id;

        // Join Socket.IO room
        socket.join(roomId);

        // Add peer to MediaSoup room
        await mediaServer.addPeer(roomId, socket.id, authSocket.userId, displayName);

        // Get router RTP capabilities
        const rtpCapabilities = mediaServer.getRouterRtpCapabilities(roomId);

        // Get existing peers
        const peers = mediaServer.getRoomPeers(roomId);
        const existingPeers: any[] = [];

        if (peers) {
          for (const [peerId, peer] of peers) {
            if (peerId !== socket.id) {
              const peerProducers: any[] = [];
              for (const [producerId, producer] of peer.producers) {
                peerProducers.push({
                  id: producerId,
                  kind: producer.kind,
                  appData: producer.appData,
                });
              }
              existingPeers.push({
                peerId,
                userId: peer.userId,
                displayName: peer.displayName,
                producers: peerProducers,
              });
            }
          }
        }

        // Notify other peers
        socket.to(roomId).emit('peer-joined', {
          peerId: socket.id,
          userId: authSocket.userId,
          displayName,
        });

        logger.info(`Peer ${socket.id} joined room ${roomId}`);

        callback({
          success: true,
          rtpCapabilities,
          existingPeers,
        });
      } catch (error: any) {
        logger.error('Error joining room:', error);
        callback({ success: false, error: error.message });
      }
    });

    socket.on('leave-room', async (callback) => {
      try {
        if (authSocket.roomId) {
          await handlePeerLeave(socket, authSocket, mediaServer);
          callback?.({ success: true });
        }
      } catch (error: any) {
        logger.error('Error leaving room:', error);
        callback?.({ success: false, error: error.message });
      }
    });

    // ========================================================================
    // WEBRTC TRANSPORT
    // ========================================================================

    socket.on('create-transport', async (data, callback) => {
      try {
        const { direction } = data;
        const roomId = authSocket.roomId!;

        const transport = await mediaServer.createWebRtcTransport(
          roomId,
          socket.id,
          direction
        );

        callback({
          success: true,
          transport,
        });
      } catch (error: any) {
        logger.error('Error creating transport:', error);
        callback({ success: false, error: error.message });
      }
    });

    socket.on('connect-transport', async (data, callback) => {
      try {
        const { transportId, dtlsParameters } = data;
        const roomId = authSocket.roomId!;

        await mediaServer.connectTransport(
          roomId,
          socket.id,
          transportId,
          dtlsParameters
        );

        callback({ success: true });
      } catch (error: any) {
        logger.error('Error connecting transport:', error);
        callback({ success: false, error: error.message });
      }
    });

    // ========================================================================
    // PRODUCING MEDIA
    // ========================================================================

    socket.on('produce', async (data, callback) => {
      try {
        const { transportId, kind, rtpParameters, appData } = data;
        const roomId = authSocket.roomId!;

        const { id: producerId } = await mediaServer.produce(
          roomId,
          socket.id,
          transportId,
          kind,
          rtpParameters,
          appData
        );

        // Notify other peers about new producer
        socket.to(roomId).emit('new-producer', {
          peerId: socket.id,
          producerId,
          kind,
          appData,
        });

        callback({ success: true, producerId });
      } catch (error: any) {
        logger.error('Error producing:', error);
        callback({ success: false, error: error.message });
      }
    });

    socket.on('close-producer', async (data, callback) => {
      try {
        const { producerId } = data;
        const roomId = authSocket.roomId!;

        await mediaServer.closeProducer(roomId, socket.id, producerId);

        socket.to(roomId).emit('producer-closed', {
          peerId: socket.id,
          producerId,
        });

        callback?.({ success: true });
      } catch (error: any) {
        logger.error('Error closing producer:', error);
        callback?.({ success: false, error: error.message });
      }
    });

    socket.on('pause-producer', async (data, callback) => {
      try {
        const { producerId } = data;
        const roomId = authSocket.roomId!;

        await mediaServer.pauseProducer(roomId, socket.id, producerId);

        socket.to(roomId).emit('producer-paused', {
          peerId: socket.id,
          producerId,
        });

        callback?.({ success: true });
      } catch (error: any) {
        callback?.({ success: false, error: error.message });
      }
    });

    socket.on('resume-producer', async (data, callback) => {
      try {
        const { producerId } = data;
        const roomId = authSocket.roomId!;

        await mediaServer.resumeProducer(roomId, socket.id, producerId);

        socket.to(roomId).emit('producer-resumed', {
          peerId: socket.id,
          producerId,
        });

        callback?.({ success: true });
      } catch (error: any) {
        callback?.({ success: false, error: error.message });
      }
    });

    // ========================================================================
    // CONSUMING MEDIA
    // ========================================================================

    socket.on('consume', async (data, callback) => {
      try {
        const { producerPeerId, producerId, transportId, rtpCapabilities } = data;
        const roomId = authSocket.roomId!;

        const consumer = await mediaServer.consume(
          roomId,
          socket.id,
          producerPeerId,
          producerId,
          transportId,
          rtpCapabilities
        );

        callback({
          success: true,
          consumer,
        });
      } catch (error: any) {
        logger.error('Error consuming:', error);
        callback({ success: false, error: error.message });
      }
    });

    socket.on('resume-consumer', async (data, callback) => {
      try {
        const { consumerId } = data;
        const roomId = authSocket.roomId!;

        await mediaServer.resumeConsumer(roomId, socket.id, consumerId);

        callback?.({ success: true });
      } catch (error: any) {
        callback?.({ success: false, error: error.message });
      }
    });

    // ========================================================================
    // CHAT MESSAGES
    // ========================================================================

    socket.on('chat-message', async (data) => {
      try {
        const { content, recipientId, type = 'text' } = data;
        const roomId = authSocket.roomId!;

        const message = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          senderId: authSocket.userId,
          senderName: authSocket.displayName,
          content,
          type,
          recipientId,
          timestamp: new Date().toISOString(),
        };

        if (recipientId) {
          // Private message
          const recipientSocket = findSocketByUserId(io, roomId, recipientId);
          if (recipientSocket) {
            recipientSocket.emit('chat-message', message);
          }
          socket.emit('chat-message', message);
        } else {
          // Broadcast to room
          io.to(roomId).emit('chat-message', message);
        }
      } catch (error) {
        logger.error('Error sending chat message:', error);
      }
    });

    // ========================================================================
    // REACTIONS & HAND RAISE
    // ========================================================================

    socket.on('reaction', (data) => {
      const { emoji } = data;
      const roomId = authSocket.roomId!;

      io.to(roomId).emit('reaction', {
        peerId: socket.id,
        userId: authSocket.userId,
        displayName: authSocket.displayName,
        emoji,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('raise-hand', (data) => {
      const { raised } = data;
      const roomId = authSocket.roomId!;

      io.to(roomId).emit('hand-raised', {
        peerId: socket.id,
        userId: authSocket.userId,
        displayName: authSocket.displayName,
        raised,
        timestamp: new Date().toISOString(),
      });
    });

    // ========================================================================
    // SCREEN SHARING
    // ========================================================================

    socket.on('screen-share-started', (data) => {
      const roomId = authSocket.roomId!;

      socket.to(roomId).emit('screen-share-started', {
        peerId: socket.id,
        userId: authSocket.userId,
        displayName: authSocket.displayName,
        producerId: data.producerId,
      });
    });

    socket.on('screen-share-stopped', () => {
      const roomId = authSocket.roomId!;

      socket.to(roomId).emit('screen-share-stopped', {
        peerId: socket.id,
        userId: authSocket.userId,
      });
    });

    // ========================================================================
    // WHITEBOARD
    // ========================================================================

    socket.on('whiteboard-draw', (data) => {
      const roomId = authSocket.roomId!;

      socket.to(roomId).emit('whiteboard-draw', {
        ...data,
        peerId: socket.id,
        userId: authSocket.userId,
      });
    });

    socket.on('whiteboard-clear', () => {
      const roomId = authSocket.roomId!;
      io.to(roomId).emit('whiteboard-clear');
    });

    // ========================================================================
    // POLLS
    // ========================================================================

    socket.on('poll-created', (data) => {
      const roomId = authSocket.roomId!;

      io.to(roomId).emit('poll-created', {
        ...data,
        createdBy: authSocket.userId,
        createdByName: authSocket.displayName,
      });
    });

    socket.on('poll-vote', (data) => {
      const roomId = authSocket.roomId!;

      io.to(roomId).emit('poll-vote', {
        ...data,
        voterId: authSocket.userId,
      });
    });

    socket.on('poll-closed', (data) => {
      const roomId = authSocket.roomId!;

      io.to(roomId).emit('poll-closed', data);
    });

    // ========================================================================
    // TRANSCRIPTION
    // ========================================================================

    socket.on('transcription-segment', (data) => {
      const roomId = authSocket.roomId!;

      io.to(roomId).emit('transcription-segment', {
        ...data,
        speakerId: authSocket.userId,
        speakerName: authSocket.displayName,
        timestamp: new Date().toISOString(),
      });
    });

    // ========================================================================
    // HOST CONTROLS
    // ========================================================================

    socket.on('mute-participant', async (data) => {
      const { targetPeerId, type, muted } = data;
      const roomId = authSocket.roomId!;

      // Verify host/co-host
      // In production, check user role from database

      io.to(targetPeerId).emit('force-mute', { type, muted });

      io.to(roomId).emit('participant-muted', {
        peerId: targetPeerId,
        type,
        muted,
        by: authSocket.displayName,
      });
    });

    socket.on('remove-participant', async (data) => {
      const { targetPeerId } = data;

      io.to(targetPeerId).emit('removed-from-meeting', {
        reason: 'Removed by host',
      });

      // The removed participant will handle disconnection
    });

    socket.on('admit-from-waiting-room', (data) => {
      const { targetPeerId } = data;

      io.to(targetPeerId).emit('admitted-to-meeting');
    });

    // ========================================================================
    // RECORDING EVENTS
    // ========================================================================

    socket.on('recording-started', () => {
      const roomId = authSocket.roomId!;

      io.to(roomId).emit('recording-started', {
        startedBy: authSocket.displayName,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('recording-stopped', () => {
      const roomId = authSocket.roomId!;

      io.to(roomId).emit('recording-stopped', {
        stoppedBy: authSocket.displayName,
        timestamp: new Date().toISOString(),
      });
    });

    // ========================================================================
    // CONNECTION QUALITY
    // ========================================================================

    socket.on('connection-quality', (data) => {
      const roomId = authSocket.roomId!;

      socket.to(roomId).emit('peer-connection-quality', {
        peerId: socket.id,
        quality: data.quality,
      });
    });

    // ========================================================================
    // DISCONNECT
    // ========================================================================

    socket.on('disconnect', async (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (Reason: ${reason})`);

      if (authSocket.roomId) {
        await handlePeerLeave(socket, authSocket, mediaServer);
      }
    });
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function handlePeerLeave(
  socket: Socket,
  authSocket: AuthenticatedSocket,
  mediaServer: MediaServer
): Promise<void> {
  const roomId = authSocket.roomId!;

  // Remove from MediaSoup
  await mediaServer.removePeer(roomId, socket.id);

  // Leave Socket.IO room
  socket.leave(roomId);

  // Notify other peers
  socket.to(roomId).emit('peer-left', {
    peerId: socket.id,
    userId: authSocket.userId,
    displayName: authSocket.displayName,
  });

  logger.info(`Peer ${socket.id} left room ${roomId}`);
}

function handleRedisEvent(io: SocketIOServer, event: any): void {
  const { type, meetingId, ...data } = event;

  switch (type) {
    case 'meeting.started':
    case 'meeting.ended':
    case 'participant.admitted':
    case 'participant.removed':
      io.to(meetingId).emit(type.replace('.', '-'), data);
      break;
  }
}

function findSocketByUserId(
  io: SocketIOServer,
  roomId: string,
  userId: string
): Socket | undefined {
  const room = io.sockets.adapter.rooms.get(roomId);
  if (!room) return undefined;

  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId) as AuthenticatedSocket;
    if (socket?.userId === userId) {
      return socket;
    }
  }

  return undefined;
}
