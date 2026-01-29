// ============================================================================
// CHATVISTA - WebRTC Hook
// Hook for WebRTC media handling with mediasoup
// ============================================================================

import { useEffect, useRef, useCallback, useState } from 'react';
import type { types as mediasoupTypes } from 'mediasoup-client';
import { Device } from 'mediasoup-client';
import { io, Socket } from 'socket.io-client';

type Transport = mediasoupTypes.Transport;
type Producer = mediasoupTypes.Producer;
type Consumer = mediasoupTypes.Consumer;

interface WebRTCConfig {
  meetingId: string;
  token: string;
  onParticipantJoined?: (participant: any) => void;
  onParticipantLeft?: (participantId: string) => void;
  onNewConsumer?: (consumer: Consumer, participant: any) => void;
}

interface WebRTCState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
}

export function useWebRTC(config: WebRTCConfig) {
  const socketRef = useRef<Socket | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);

  const [state, setState] = useState<WebRTCState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    producers: new Map(),
    consumers: new Map(),
  });

  // Connect to signaling server and create transports
  const connect = useCallback(async () => {
    if (state.isConnected || state.isConnecting) return;

    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      // Create socket connection
      const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', {
        auth: { token: config.token },
        transports: ['websocket'],
      });

      socketRef.current = socket;

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        socket.on('connect', resolve);
        socket.on('connect_error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 10000);
      });

      // Create mediasoup device
      const device = new Device();
      deviceRef.current = device;

      // Get router RTP capabilities
      const rtpCapabilities = await new Promise<any>((resolve, reject) => {
        socket.emit('get-rtp-capabilities', { meetingId: config.meetingId }, (response: any) => {
          if (response.error) reject(new Error(response.error));
          else resolve(response.rtpCapabilities);
        });
      });

      // Load the device
      await device.load({ routerRtpCapabilities: rtpCapabilities });

      // Create send transport
      sendTransportRef.current = await createSendTransport(socket, device, config.meetingId);

      // Create receive transport
      recvTransportRef.current = await createRecvTransport(socket, device, config.meetingId);

      // Join the room
      await new Promise<void>((resolve, reject) => {
        socket.emit('join-room', { 
          meetingId: config.meetingId,
          rtpCapabilities: device.rtpCapabilities,
        }, (response: any) => {
          if (response.error) reject(new Error(response.error));
          else resolve();
        });
      });

      // Set up event listeners
      setupEventListeners(socket);

      setState((prev) => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: (error as Error).message,
      }));
    }
  }, [config.meetingId, config.token, state.isConnected, state.isConnecting]);

  // Create send transport
  const createSendTransport = async (
    socket: Socket,
    device: Device,
    meetingId: string
  ): Promise<Transport> => {
    const transportInfo = await new Promise<any>((resolve, reject) => {
      socket.emit('create-webrtc-transport', { 
        meetingId, 
        producing: true,
        consuming: false,
      }, (response: any) => {
        if (response.error) reject(new Error(response.error));
        else resolve(response);
      });
    });

    const transport = device.createSendTransport({
      id: transportInfo.id,
      iceParameters: transportInfo.iceParameters,
      iceCandidates: transportInfo.iceCandidates,
      dtlsParameters: transportInfo.dtlsParameters,
      sctpParameters: transportInfo.sctpParameters,
    });

    transport.on('connect', async (
      { dtlsParameters }: { dtlsParameters: mediasoupTypes.DtlsParameters },
      callback: () => void,
      errback: (error: Error) => void
    ) => {
      try {
        await new Promise<void>((resolve, reject) => {
          socket.emit('connect-transport', {
            meetingId,
            transportId: transport.id,
            dtlsParameters,
          }, (response: any) => {
            if (response.error) reject(new Error(response.error));
            else resolve();
          });
        });
        callback();
      } catch (error) {
        errback(error as Error);
      }
    });

    transport.on('produce', async (
      { kind, rtpParameters, appData }: { kind: mediasoupTypes.MediaKind; rtpParameters: mediasoupTypes.RtpParameters; appData: Record<string, unknown> },
      callback: (params: { id: string }) => void,
      errback: (error: Error) => void
    ) => {
      try {
        const { producerId } = await new Promise<any>((resolve, reject) => {
          socket.emit('produce', {
            meetingId,
            transportId: transport.id,
            kind,
            rtpParameters,
            appData,
          }, (response: any) => {
            if (response.error) reject(new Error(response.error));
            else resolve(response);
          });
        });
        callback({ id: producerId });
      } catch (error) {
        errback(error as Error);
      }
    });

    return transport;
  };

  // Create receive transport
  const createRecvTransport = async (
    socket: Socket,
    device: Device,
    meetingId: string
  ): Promise<Transport> => {
    const transportInfo = await new Promise<any>((resolve, reject) => {
      socket.emit('create-webrtc-transport', {
        meetingId,
        producing: false,
        consuming: true,
      }, (response: any) => {
        if (response.error) reject(new Error(response.error));
        else resolve(response);
      });
    });

    const transport = device.createRecvTransport({
      id: transportInfo.id,
      iceParameters: transportInfo.iceParameters,
      iceCandidates: transportInfo.iceCandidates,
      dtlsParameters: transportInfo.dtlsParameters,
      sctpParameters: transportInfo.sctpParameters,
    });

    transport.on('connect', async (
      { dtlsParameters }: { dtlsParameters: mediasoupTypes.DtlsParameters },
      callback: () => void,
      errback: (error: Error) => void
    ) => {
      try {
        await new Promise<void>((resolve, reject) => {
          socket.emit('connect-transport', {
            meetingId,
            transportId: transport.id,
            dtlsParameters,
          }, (response: any) => {
            if (response.error) reject(new Error(response.error));
            else resolve();
          });
        });
        callback();
      } catch (error) {
        errback(error as Error);
      }
    });

    return transport;
  };

  // Set up socket event listeners
  const setupEventListeners = useCallback((socket: Socket) => {
    socket.on('new-producer', async (data) => {
      await consumeProducer(data.producerId, data.participant);
    });

    socket.on('producer-closed', (data) => {
      const consumer = state.consumers.get(data.producerId);
      if (consumer) {
        consumer.close();
        setState((prev) => {
          const consumers = new Map(prev.consumers);
          consumers.delete(data.producerId);
          return { ...prev, consumers };
        });
      }
    });

    socket.on('participant-joined', (participant) => {
      config.onParticipantJoined?.(participant);
    });

    socket.on('participant-left', (data) => {
      config.onParticipantLeft?.(data.participantId);
    });
  }, [config, state.consumers]);

  // Consume a producer
  const consumeProducer = useCallback(async (producerId: string, participant: any) => {
    if (!recvTransportRef.current || !socketRef.current || !deviceRef.current) return;

    const { consumer, track } = await new Promise<any>((resolve, reject) => {
      socketRef.current!.emit('consume', {
        meetingId: config.meetingId,
        producerId,
        rtpCapabilities: deviceRef.current!.rtpCapabilities,
      }, async (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }

        const consumer = await recvTransportRef.current!.consume({
          id: response.id,
          producerId: response.producerId,
          kind: response.kind,
          rtpParameters: response.rtpParameters,
        });

        resolve({ consumer, track: consumer.track });
      });
    });

    setState((prev) => {
      const consumers = new Map(prev.consumers);
      consumers.set(producerId, consumer);
      return { ...prev, consumers };
    });

    config.onNewConsumer?.(consumer, participant);
  }, [config]);

  // Produce audio/video
  const produce = useCallback(async (track: MediaStreamTrack): Promise<Producer | null> => {
    if (!sendTransportRef.current) return null;

    try {
      const producer = await sendTransportRef.current.produce({
        track,
        codecOptions: {
          videoGoogleStartBitrate: 1000,
        },
      });

      setState((prev) => {
        const producers = new Map(prev.producers);
        producers.set(producer.id, producer);
        return { ...prev, producers };
      });

      return producer;
    } catch (error) {
      console.error('Failed to produce:', error);
      return null;
    }
  }, []);

  // Close a producer
  const closeProducer = useCallback(async (producerId: string) => {
    const producer = state.producers.get(producerId);
    if (!producer) return;

    producer.close();

    socketRef.current?.emit('close-producer', {
      meetingId: config.meetingId,
      producerId,
    });

    setState((prev) => {
      const producers = new Map(prev.producers);
      producers.delete(producerId);
      return { ...prev, producers };
    });
  }, [config.meetingId, state.producers]);

  // Disconnect
  const disconnect = useCallback(() => {
    // Close all producers
    state.producers.forEach((producer) => producer.close());

    // Close all consumers
    state.consumers.forEach((consumer) => consumer.close());

    // Close transports
    sendTransportRef.current?.close();
    recvTransportRef.current?.close();

    // Disconnect socket
    socketRef.current?.disconnect();

    setState({
      isConnected: false,
      isConnecting: false,
      error: null,
      producers: new Map(),
      consumers: new Map(),
    });
  }, [state.consumers, state.producers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    produce,
    closeProducer,
    device: deviceRef.current,
  };
}
