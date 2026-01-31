// ============================================================================
// CHATVISTA - Main Application Entry Point
// Enterprise Video Conferencing Platform
// ============================================================================

import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import usersRouter from './routes/users';
import { meetingsRouter } from './routes/meetings';
import transcriptRouter from './routes/transcripts';
import minutesRouter from './routes/minutes';
import recordingsRouter from './routes/recordings';
import exportRouter from './routes/exports';
import analyticsRouter from './routes/analytics';
import adminRouter from './routes/admin';
import webhooksRouter from './routes/webhooks';
import storageRouter from './routes/storage';
import { initializeSocketHandlers } from './socket';
import { MediaServer } from './media/MediaServer';

class Application {
  public app: Express;
  public server: ReturnType<typeof createServer>;
  public io: SocketIOServer;
  public mediaServer: MediaServer;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: config.cors.origins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });
    this.mediaServer = new MediaServer();

    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          mediaSrc: ["'self'", 'blob:'],
          connectSrc: ["'self'", 'wss:', 'ws:', 'https:'],
          fontSrc: ["'self'", 'data:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));

    // CORS
    this.app.use(cors({
      origin: config.cors.origins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    }));

    // Compression
    this.app.use(compression());

    // Request parsing
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    this.app.use(cookieParser(config.session.secret));

    // Logging
    this.app.use(morgan('combined', {
      stream: { write: (message: string) => logger.http(message.trim()) },
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      message: { error: 'Too many requests, please try again later.' },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Request ID
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      req.id = req.headers['x-request-id'] as string || crypto.randomUUID();
      res.setHeader('X-Request-ID', req.id);
      next();
    });
  }

  private initializeRoutes(): void {
    // Health check
    this.app.get('/health', async (_req: Request, res: Response) => {
      try {
        // Check database
        await prisma.$queryRaw`SELECT 1`;
        
        // Check Redis (optional - may not be available in dev)
        let redisStatus = 'unavailable';
        try {
          await redis.ping();
          redisStatus = 'connected';
        } catch {
          redisStatus = 'unavailable (using in-memory fallback)';
        }
        
        // Import storage service for health check
        const { storageService } = await import('./services/StorageService');
        const storageStats = await storageService.getStorageStats();
        
        res.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: config.version,
          services: {
            database: 'connected',
            redis: redisStatus,
            mediaServer: this.mediaServer.isReady ? 'ready' : 'initializing',
            storage: {
              local: 'available',
              cloud: storageService.isCloudAvailable() ? 'connected' : 'unavailable',
              totalSize: storageStats.local.totalSize,
            },
          },
        });
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Service unavailable',
        });
      }
    });

    // API routes
    this.app.use('/api/v1/auth', authRouter);
    this.app.use('/api/v1/users', usersRouter);
    this.app.use('/api/v1/meetings', meetingsRouter);
    this.app.use('/api/v1/transcripts', transcriptRouter);
    this.app.use('/api/v1/minutes', minutesRouter);
    this.app.use('/api/v1/recordings', recordingsRouter);
    this.app.use('/api/v1/export', exportRouter);
    this.app.use('/api/v1/analytics', analyticsRouter);
    this.app.use('/api/v1/admin', adminRouter);
    this.app.use('/api/v1/webhooks', webhooksRouter);
    this.app.use('/api/v1/storage', storageRouter);

    // API documentation
    this.app.get('/api', (_req: Request, res: Response) => {
      res.json({
        name: 'ChatVista API',
        version: config.version,
        documentation: '/api/docs',
        endpoints: {
          auth: '/api/v1/auth',
          users: '/api/v1/users',
          meetings: '/api/v1/meetings',
          transcripts: '/api/v1/transcripts',
          minutes: '/api/v1/minutes',
          recordings: '/api/v1/recordings',
          export: '/api/v1/export',
          analytics: '/api/v1/analytics',
          admin: '/api/v1/admin',
          webhooks: '/api/v1/webhooks',
        },
      });
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Connect to database (optional in development)
      try {
        await prisma.$connect();
        logger.info('✅ Connected to PostgreSQL database');
      } catch (dbError) {
        if (config.env === 'development') {
          logger.warn('⚠️ Could not connect to PostgreSQL - database features disabled');
        } else {
          throw dbError;
        }
      }

      // Test Redis connection (optional in development)
      try {
        await redis.ping();
        logger.info('✅ Connected to Redis');
      } catch (redisError) {
        if (config.env === 'development') {
          logger.warn('⚠️ Could not connect to Redis - using in-memory cache');
        } else {
          throw redisError;
        }
      }

      // Initialize media server
      try {
        await this.mediaServer.initialize();
        logger.info('✅ MediaSoup server initialized');
      } catch (mediaError) {
        if (config.env === 'development') {
          logger.warn('⚠️ Could not initialize MediaSoup - WebRTC features disabled');
        } else {
          throw mediaError;
        }
      }

      // Initialize Socket.IO handlers
      initializeSocketHandlers(this.io, this.mediaServer);
      logger.info('✅ Socket.IO handlers initialized');

      // Start HTTP server
      this.server.listen(config.port, () => {
        logger.info(`🚀 ChatVista server running on port ${config.port}`);
        logger.info(`📍 Environment: ${config.env}`);
        logger.info(`📍 API URL: ${config.apiUrl}`);
      });

      // Graceful shutdown
      this.setupGracefulShutdown();
    } catch (error) {
      logger.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, starting graceful shutdown...`);

      // Close Socket.IO
      this.io.close();
      logger.info('Socket.IO server closed');

      // Close HTTP server
      this.server.close();
      logger.info('HTTP server closed');

      // Close media server
      await this.mediaServer.close();
      logger.info('Media server closed');

      // Close database connection
      await prisma.$disconnect();
      logger.info('Database connection closed');

      // Close Redis connection
      await redis.quit();
      logger.info('Redis connection closed');

      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      id?: string;
      user?: {
        id: string;
        email: string;
        role: string;
        organizationId: string;
      };
    }
  }
}

// Start application
const app = new Application();
app.start();

export { app };
