// ============================================================================
// CHATVISTA - Rate Limiter Middleware
// Request rate limiting for API protection
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import { redis } from '../lib/redis';

interface RateLimitOptions {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  keyPrefix?: string;    // Redis key prefix
  message?: string;      // Custom error message
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    keyPrefix = 'rl:',
    message = 'Too many requests, please try again later.',
    skipFailedRequests = false,
    skipSuccessfulRequests = false,
    keyGenerator = (req) => req.ip || 'unknown',
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = keyPrefix + keyGenerator(req);
      
      const current = await redis.incr(key);
      
      if (current === 1) {
        await redis.expire(key, Math.ceil(windowMs / 1000));
      }

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));
      
      const ttl = await redis.ttl(key);
      res.setHeader('X-RateLimit-Reset', Date.now() + ttl * 1000);

      if (current > maxRequests) {
        res.setHeader('Retry-After', Math.ceil(ttl));
        
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message,
            retryAfter: ttl,
          },
        });
        return;
      }

      // Handle skip options
      if (skipFailedRequests || skipSuccessfulRequests) {
        const originalEnd = res.end.bind(res);
        res.end = function(...args: any[]) {
          const statusCode = res.statusCode;
          const isSuccess = statusCode >= 200 && statusCode < 400;

          if ((skipSuccessfulRequests && isSuccess) || (skipFailedRequests && !isSuccess)) {
            redis.decr(key).catch(() => {});
          }

          return originalEnd(...args);
        };
      }

      next();
    } catch (error) {
      // If Redis fails, allow the request through
      console.error('Rate limiter error:', error);
      next();
    }
  };
}

// Preset rate limiters
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10,
  keyPrefix: 'rl:auth:',
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  skipSuccessfulRequests: true,
});

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  keyPrefix: 'rl:api:',
});

export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 20,
  keyPrefix: 'rl:upload:',
  message: 'Upload limit reached. Please try again later.',
});

// User-specific rate limiter (uses user ID instead of IP)
export const userRateLimiter = (options: Omit<RateLimitOptions, 'keyGenerator'>) => {
  return rateLimit({
    ...options,
    keyGenerator: (req) => {
      const userId = (req as any).user?.id;
      return userId || req.ip || 'unknown';
    },
  });
};
