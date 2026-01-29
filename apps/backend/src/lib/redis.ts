// ============================================================================
// CHATVISTA - Redis Client Configuration
// ============================================================================

import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

let redisAvailable = true;

class RedisClient {
  private static instance: Redis | null = null;
  private static subscriber: Redis | null = null;
  private static publisher: Redis | null = null;
  private static memoryCache: Map<string, { value: string; expires?: number }> = new Map();

  public static getInstance(): Redis {
    if (!RedisClient.instance) {
      try {
        RedisClient.instance = new Redis(config.redisUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            if (times > 3) {
              logger.warn('Redis unavailable - using in-memory cache for development');
              redisAvailable = false;
              return null;
            }
            return Math.min(times * 100, 3000);
          },
          enableReadyCheck: true,
          lazyConnect: true,
          connectTimeout: 5000,
        });

        RedisClient.instance.on('connect', () => {
          logger.info('Redis client connected');
          redisAvailable = true;
        });

        RedisClient.instance.on('ready', () => {
          logger.info('Redis client ready');
        });

        RedisClient.instance.on('error', (error) => {
          if (config.env === 'development') {
            logger.warn('Redis unavailable in development - using in-memory fallback');
            redisAvailable = false;
          } else {
            logger.error('Redis client error:', error);
          }
        });

        RedisClient.instance.on('close', () => {
          logger.warn('Redis connection closed');
        });

        RedisClient.instance.on('reconnecting', () => {
          logger.info('Redis client reconnecting...');
        });

        // Try to connect
        RedisClient.instance.connect().catch(() => {
          logger.warn('Redis connection failed - using in-memory cache');
          redisAvailable = false;
        });
      } catch (error) {
        logger.warn('Failed to initialize Redis - using in-memory cache');
        redisAvailable = false;
      }
    }

    return RedisClient.instance as Redis;
  }

  public static getSubscriber(): Redis | null {
    if (!redisAvailable) return null;
    if (!RedisClient.subscriber) {
      RedisClient.subscriber = RedisClient.getInstance().duplicate();
    }
    return RedisClient.subscriber;
  }

  public static getPublisher(): Redis | null {
    if (!redisAvailable) return null;
    if (!RedisClient.publisher) {
      RedisClient.publisher = RedisClient.getInstance().duplicate();
    }
    return RedisClient.publisher;
  }

  public static getMemoryCache() {
    return RedisClient.memoryCache;
  }
}

export const redis = RedisClient.getInstance();
export const redisSub = RedisClient.getSubscriber();
export const redisPub = RedisClient.getPublisher();
export const isRedisAvailable = () => redisAvailable;

// Safe publish function with null check
export async function safePublish(channel: string, message: string): Promise<void> {
  if (redisPub) {
    await redisPub.publish(channel, message);
  }
}

const memoryCache = new Map<string, { value: string; expires?: number }>();

// Cache helper functions with in-memory fallback
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      if (redisAvailable && redis) {
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
      } else {
        // In-memory fallback
        const cached = memoryCache.get(key);
        if (cached) {
          if (cached.expires && Date.now() > cached.expires) {
            memoryCache.delete(key);
            return null;
          }
          return JSON.parse(cached.value);
        }
        return null;
      }
    } catch {
      return null;
    }
  },

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (redisAvailable && redis) {
        if (ttlSeconds) {
          await redis.setex(key, ttlSeconds, serialized);
        } else {
          await redis.set(key, serialized);
        }
      } else {
        // In-memory fallback
        memoryCache.set(key, {
          value: serialized,
          expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
        });
      }
    } catch {
      // Ignore cache errors
    }
  },

  async del(key: string): Promise<void> {
    try {
      if (redisAvailable && redis) {
        await redis.del(key);
      } else {
        memoryCache.delete(key);
      }
    } catch {
      // Ignore
    }
  },

  async exists(key: string): Promise<boolean> {
    try {
      if (redisAvailable && redis) {
        return (await redis.exists(key)) === 1;
      } else {
        return memoryCache.has(key);
      }
    } catch {
      return false;
    }
  },

  async keys(pattern: string): Promise<string[]> {
    try {
      if (redisAvailable && redis) {
        return redis.keys(pattern);
      } else {
        const regex = new RegExp(pattern.replace('*', '.*'));
        return Array.from(memoryCache.keys()).filter((k) => regex.test(k));
      }
    } catch {
      return [];
    }
  },

  async flushPattern(pattern: string): Promise<void> {
    try {
      if (redisAvailable && redis) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } else {
        const regex = new RegExp(pattern.replace('*', '.*'));
        for (const key of memoryCache.keys()) {
          if (regex.test(key)) {
            memoryCache.delete(key);
          }
        }
      }
    } catch {
      // Ignore
    }
  },

  // Session management
  async setSession(sessionId: string, data: any, ttlSeconds: number = 86400): Promise<void> {
    await this.set(`session:${sessionId}`, data, ttlSeconds);
  },

  async getSession<T>(sessionId: string): Promise<T | null> {
    return this.get<T>(`session:${sessionId}`);
  },

  async deleteSession(sessionId: string): Promise<void> {
    await this.del(`session:${sessionId}`);
  },

  // Meeting room state
  async setMeetingState(meetingId: string, state: any): Promise<void> {
    await this.set(`meeting:${meetingId}:state`, state);
  },

  async getMeetingState<T>(meetingId: string): Promise<T | null> {
    return this.get<T>(`meeting:${meetingId}:state`);
  },

  // Participant state
  async addParticipant(meetingId: string, participantId: string, data: any): Promise<void> {
    try {
      if (redisAvailable && redis) {
        await redis.hset(`meeting:${meetingId}:participants`, participantId, JSON.stringify(data));
      } else {
        const key = `meeting:${meetingId}:participants`;
        const existing = memoryCache.get(key);
        const participants = existing ? JSON.parse(existing.value) : {};
        participants[participantId] = data;
        memoryCache.set(key, { value: JSON.stringify(participants) });
      }
    } catch {
      // Ignore
    }
  },

  async removeParticipant(meetingId: string, participantId: string): Promise<void> {
    try {
      if (redisAvailable && redis) {
        await redis.hdel(`meeting:${meetingId}:participants`, participantId);
      } else {
        const key = `meeting:${meetingId}:participants`;
        const existing = memoryCache.get(key);
        if (existing) {
          const participants = JSON.parse(existing.value);
          delete participants[participantId];
          memoryCache.set(key, { value: JSON.stringify(participants) });
        }
      }
    } catch {
      // Ignore
    }
  },

  async getParticipants(meetingId: string): Promise<Record<string, any>> {
    try {
      if (redisAvailable && redis) {
        const participants = await redis.hgetall(`meeting:${meetingId}:participants`);
        const result: Record<string, any> = {};
        for (const [key, value] of Object.entries(participants)) {
          result[key] = JSON.parse(value);
        }
        return result;
      } else {
        const key = `meeting:${meetingId}:participants`;
        const existing = memoryCache.get(key);
        return existing ? JSON.parse(existing.value) : {};
      }
    } catch {
      return {};
    }
  },

  // Rate limiting
  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    try {
      if (redisAvailable && redis) {
        const current = await redis.incr(key);
        if (current === 1) {
          await redis.expire(key, windowSeconds);
        }
        return current <= limit;
      } else {
        // Simple in-memory rate limiting
        const existing = memoryCache.get(`ratelimit:${key}`);
        let count = 1;
        if (existing) {
          if (existing.expires && Date.now() > existing.expires) {
            count = 1;
          } else {
            count = parseInt(existing.value) + 1;
          }
        }
        memoryCache.set(`ratelimit:${key}`, {
          value: count.toString(),
          expires: Date.now() + windowSeconds * 1000,
        });
        return count <= limit;
      }
    } catch {
      return true; // Allow on error
    }
  },
};

export default redis;
