// ============================================================================
// CHATVISTA - MediaSoup SFU Media Server
// ============================================================================

import * as mediasoup from 'mediasoup';
import { config } from '../config';
import { logger } from '../utils/logger';

interface Room {
  id: string;
  router: mediasoup.types.Router;
  peers: Map<string, Peer>;
  createdAt: Date;
}

interface Peer {
  id: string;
  userId: string;
  displayName: string;
  transports: Map<string, mediasoup.types.WebRtcTransport>;
  producers: Map<string, mediasoup.types.Producer>;
  consumers: Map<string, mediasoup.types.Consumer>;
  dataProducers: Map<string, mediasoup.types.DataProducer>;
  dataConsumers: Map<string, mediasoup.types.DataConsumer>;
}

export class MediaServer {
  private workers: mediasoup.types.Worker[] = [];
  private nextWorkerIndex = 0;
  private rooms: Map<string, Room> = new Map();
  public isReady = false;

  // MediaSoup configuration
  private readonly mediaCodecs: mediasoup.types.RtpCodecCapability[] = [
    {
      kind: 'audio',
      mimeType: 'audio/opus',
      preferredPayloadType: 100,
      clockRate: 48000,
      channels: 2,
      parameters: {
        minptime: 10,
        useinbandfec: 1,
      },
    },
    {
      kind: 'video',
      mimeType: 'video/VP8',
      preferredPayloadType: 101,
      clockRate: 90000,
      parameters: {
        'x-google-start-bitrate': 1000,
      },
    },
    {
      kind: 'video',
      mimeType: 'video/VP9',
      preferredPayloadType: 102,
      clockRate: 90000,
      parameters: {
        'profile-id': 2,
        'x-google-start-bitrate': 1000,
      },
    },
    {
      kind: 'video',
      mimeType: 'video/H264',
      preferredPayloadType: 103,
      clockRate: 90000,
      parameters: {
        'packetization-mode': 1,
        'profile-level-id': '4d0032',
        'level-asymmetry-allowed': 1,
        'x-google-start-bitrate': 1000,
      },
    },
    {
      kind: 'video',
      mimeType: 'video/H264',
      preferredPayloadType: 104,
      clockRate: 90000,
      parameters: {
        'packetization-mode': 1,
        'profile-level-id': '42e01f',
        'level-asymmetry-allowed': 1,
        'x-google-start-bitrate': 1000,
      },
    },
  ];

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async initialize(): Promise<void> {
    logger.info('Initializing MediaSoup workers...');

    // Create workers based on CPU cores
    const numWorkers = Math.min(
      require('os').cpus().length,
      4 // Limit to 4 workers
    );

    for (let i = 0; i < numWorkers; i++) {
      await this.createWorker();
    }

    this.isReady = true;
    logger.info(`MediaSoup initialized with ${numWorkers} workers`);
  }

  private async createWorker(): Promise<void> {
    const worker = await mediasoup.createWorker({
      logLevel: 'warn',
      logTags: [
        'info',
        'ice',
        'dtls',
        'rtp',
        'srtp',
        'rtcp',
      ],
      rtcMinPort: config.mediasoup.rtcMinPort,
      rtcMaxPort: config.mediasoup.rtcMaxPort,
    });

    worker.on('died', (error) => {
      logger.error('MediaSoup worker died:', error);
      
      // Remove dead worker
      const index = this.workers.indexOf(worker);
      if (index !== -1) {
        this.workers.splice(index, 1);
      }

      // Create replacement worker
      setTimeout(() => this.createWorker(), 2000);
    });

    this.workers.push(worker);
    logger.info(`MediaSoup worker ${worker.pid} created`);
  }

  private getNextWorker(): mediasoup.types.Worker {
    const worker = this.workers[this.nextWorkerIndex];
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  // ============================================================================
  // ROOM MANAGEMENT
  // ============================================================================

  async createRoom(roomId: string): Promise<Room> {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }

    const worker = this.getNextWorker();
    const router = await worker.createRouter({
      mediaCodecs: this.mediaCodecs,
    });

    const room: Room = {
      id: roomId,
      router,
      peers: new Map(),
      createdAt: new Date(),
    };

    this.rooms.set(roomId, room);
    logger.info(`Room created: ${roomId}`);

    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  async closeRoom(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Close all transports for all peers
    for (const peer of room.peers.values()) {
      for (const transport of peer.transports.values()) {
        transport.close();
      }
    }

    room.router.close();
    this.rooms.delete(roomId);

    logger.info(`Room closed: ${roomId}`);
  }

  // ============================================================================
  // PEER MANAGEMENT
  // ============================================================================

  async addPeer(roomId: string, peerId: string, userId: string, displayName: string): Promise<Peer> {
    const room = await this.createRoom(roomId);

    const peer: Peer = {
      id: peerId,
      userId,
      displayName,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
      dataProducers: new Map(),
      dataConsumers: new Map(),
    };

    room.peers.set(peerId, peer);
    logger.info(`Peer added to room ${roomId}: ${peerId}`);

    return peer;
  }

  async removePeer(roomId: string, peerId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const peer = room.peers.get(peerId);
    if (!peer) return;

    // Close all transports (this also closes producers and consumers)
    for (const transport of peer.transports.values()) {
      transport.close();
    }

    room.peers.delete(peerId);
    logger.info(`Peer removed from room ${roomId}: ${peerId}`);

    // If room is empty, close it
    if (room.peers.size === 0) {
      await this.closeRoom(roomId);
    }
  }

  // ============================================================================
  // TRANSPORT MANAGEMENT
  // ============================================================================

  async createWebRtcTransport(
    roomId: string,
    peerId: string,
    _direction: 'send' | 'recv'
  ): Promise<{
    id: string;
    iceParameters: mediasoup.types.IceParameters;
    iceCandidates: mediasoup.types.IceCandidate[];
    dtlsParameters: mediasoup.types.DtlsParameters;
    sctpParameters?: mediasoup.types.SctpParameters;
  }> {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const peer = room.peers.get(peerId);
    if (!peer) {
      throw new Error('Peer not found');
    }

    const transport = await room.router.createWebRtcTransport({
      listenIps: [
        {
          ip: config.mediasoup.listenIp,
          announcedIp: config.mediasoup.announcedIp,
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      enableSctp: true,
      numSctpStreams: { OS: 1024, MIS: 1024 },
      initialAvailableOutgoingBitrate: 1000000,
    });

    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        logger.debug(`Transport closed: ${transport.id}`);
        transport.close();
      }
    });

    peer.transports.set(transport.id, transport);

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters,
    };
  }

  async connectTransport(
    roomId: string,
    peerId: string,
    transportId: string,
    dtlsParameters: mediasoup.types.DtlsParameters
  ): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    const peer = room.peers.get(peerId);
    if (!peer) throw new Error('Peer not found');

    const transport = peer.transports.get(transportId);
    if (!transport) throw new Error('Transport not found');

    await transport.connect({ dtlsParameters });
  }

  // ============================================================================
  // PRODUCER MANAGEMENT
  // ============================================================================

  async produce(
    roomId: string,
    peerId: string,
    transportId: string,
    kind: mediasoup.types.MediaKind,
    rtpParameters: mediasoup.types.RtpParameters,
    appData?: Record<string, unknown>
  ): Promise<{ id: string }> {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    const peer = room.peers.get(peerId);
    if (!peer) throw new Error('Peer not found');

    const transport = peer.transports.get(transportId);
    if (!transport) throw new Error('Transport not found');

    const producer = await transport.produce({
      kind,
      rtpParameters,
      appData: {
        peerId,
        ...appData,
      },
    });

    producer.on('transportclose', () => {
      producer.close();
      peer.producers.delete(producer.id);
    });

    peer.producers.set(producer.id, producer);

    return { id: producer.id };
  }

  async closeProducer(
    roomId: string,
    peerId: string,
    producerId: string
  ): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const peer = room.peers.get(peerId);
    if (!peer) return;

    const producer = peer.producers.get(producerId);
    if (!producer) return;

    producer.close();
    peer.producers.delete(producerId);
  }

  async pauseProducer(
    roomId: string,
    peerId: string,
    producerId: string
  ): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const peer = room.peers.get(peerId);
    if (!peer) return;

    const producer = peer.producers.get(producerId);
    if (!producer) return;

    await producer.pause();
  }

  async resumeProducer(
    roomId: string,
    peerId: string,
    producerId: string
  ): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const peer = room.peers.get(peerId);
    if (!peer) return;

    const producer = peer.producers.get(producerId);
    if (!producer) return;

    await producer.resume();
  }

  // ============================================================================
  // CONSUMER MANAGEMENT
  // ============================================================================

  async consume(
    roomId: string,
    consumerPeerId: string,
    producerPeerId: string,
    producerId: string,
    transportId: string,
    rtpCapabilities: mediasoup.types.RtpCapabilities
  ): Promise<{
    id: string;
    producerId: string;
    kind: mediasoup.types.MediaKind;
    rtpParameters: mediasoup.types.RtpParameters;
    producerPaused: boolean;
  }> {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    // Check if router can consume
    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error('Cannot consume');
    }

    const consumerPeer = room.peers.get(consumerPeerId);
    if (!consumerPeer) throw new Error('Consumer peer not found');

    const transport = consumerPeer.transports.get(transportId);
    if (!transport) throw new Error('Transport not found');

    const producerPeer = room.peers.get(producerPeerId);
    if (!producerPeer) throw new Error('Producer peer not found');

    const producer = producerPeer.producers.get(producerId);
    if (!producer) throw new Error('Producer not found');

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true, // Start paused, resume after client is ready
      appData: {
        peerId: consumerPeerId,
        producerPeerId,
      },
    });

    consumer.on('transportclose', () => {
      consumer.close();
      consumerPeer.consumers.delete(consumer.id);
    });

    consumer.on('producerclose', () => {
      consumer.close();
      consumerPeer.consumers.delete(consumer.id);
    });

    consumerPeer.consumers.set(consumer.id, consumer);

    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      producerPaused: producer.paused,
    };
  }

  async resumeConsumer(
    roomId: string,
    peerId: string,
    consumerId: string
  ): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const peer = room.peers.get(peerId);
    if (!peer) return;

    const consumer = peer.consumers.get(consumerId);
    if (!consumer) return;

    await consumer.resume();
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  getRouterRtpCapabilities(roomId: string): mediasoup.types.RtpCapabilities | null {
    const room = this.rooms.get(roomId);
    return room?.router.rtpCapabilities ?? null;
  }

  getRoomPeers(roomId: string): Map<string, Peer> | undefined {
    const room = this.rooms.get(roomId);
    return room?.peers;
  }

  getPeerProducers(roomId: string, peerId: string): Map<string, mediasoup.types.Producer> | undefined {
    const room = this.rooms.get(roomId);
    const peer = room?.peers.get(peerId);
    return peer?.producers;
  }

  async getProducerStats(
    roomId: string,
    peerId: string,
    producerId: string
  ): Promise<mediasoup.types.ProducerStat[]> {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    const peer = room.peers.get(peerId);
    if (!peer) return [];

    const producer = peer.producers.get(producerId);
    if (!producer) return [];

    return producer.getStats();
  }

  async getConsumerStats(
    roomId: string,
    peerId: string,
    consumerId: string
  ): Promise<mediasoup.types.ConsumerStat[]> {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    const peer = room.peers.get(peerId);
    if (!peer) return [];

    const consumer = peer.consumers.get(consumerId);
    if (!consumer) return [];

    return consumer.getStats();
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  async close(): Promise<void> {
    // Close all rooms
    for (const roomId of this.rooms.keys()) {
      await this.closeRoom(roomId);
    }

    // Close all workers
    for (const worker of this.workers) {
      worker.close();
    }

    this.workers = [];
    this.isReady = false;

    logger.info('MediaSoup server closed');
  }
}
