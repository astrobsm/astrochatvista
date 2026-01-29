// ============================================================================
// CHATVISTA - Security Middleware
// Security headers and protection middleware
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from '../config';

// CORS configuration
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    const allowedOrigins = config.cors.origins;
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400, // 24 hours
});

// Helmet configuration for security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'wss:', 'ws:'],
      mediaSrc: ["'self'", 'blob:'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for mediasoup
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

// Request ID middleware
export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = req.headers['x-request-id'] as string || 
    `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  req.id = id;
  res.setHeader('X-Request-ID', id);
  
  next();
}

// Sanitize request body (basic XSS prevention)
export function sanitizeBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  next();
}

function sanitizeObject(obj: any): void {
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') {
      obj[key] = obj[key]
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

// Prevent parameter pollution
export function preventParamPollution(req: Request, _res: Response, next: NextFunction) {
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      if (Array.isArray(req.query[key])) {
        // Take only the last value
        req.query[key] = (req.query[key] as string[])[0];
      }
    }
  }
  next();
}

// IP blocking middleware
const blockedIPs = new Set<string>();

export function ipBlocker(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || '';
  
  if (blockedIPs.has(ip)) {
    res.status(403).json({
      success: false,
      error: {
        code: 'IP_BLOCKED',
        message: 'Access denied',
      },
    });
    return;
  }
  
  next();
}

export function blockIP(ip: string): void {
  blockedIPs.add(ip);
}

export function unblockIP(ip: string): void {
  blockedIPs.delete(ip);
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}
