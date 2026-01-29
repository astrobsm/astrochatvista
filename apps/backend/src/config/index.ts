// ============================================================================
// CHATVISTA - Application Configuration
// ============================================================================

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  // Application
  env: z.enum(['development', 'staging', 'production']).default('development'),
  port: z.coerce.number().default(4000),
  appName: z.string().default('ChatVista'),
  appUrl: z.string().default('http://localhost:3000'),
  apiUrl: z.string().default('http://localhost:4000'),
  version: z.string().default('1.0.0'),

  // Database
  databaseUrl: z.string(),

  // Redis
  redisUrl: z.string(),
  redisHost: z.string().default('localhost'),
  redisPort: z.coerce.number().default(6379),
  redisPassword: z.string().optional(),

  // JWT
  jwtSecret: z.string().min(32),
  jwtRefreshSecret: z.string().min(32),
  jwtAccessExpiry: z.string().default('15m'),
  jwtRefreshExpiry: z.string().default('7d'),

  // Session
  sessionSecret: z.string().min(32),

  // Encryption
  encryptionKey: z.string().length(64), // 32 bytes hex
  signingKey: z.string().length(64),

  // Storage (MinIO/S3)
  minioEndpoint: z.string().default('localhost'),
  minioPort: z.coerce.number().default(9000),
  minioUseSsl: z.coerce.boolean().default(false),
  minioAccessKey: z.string(),
  minioSecretKey: z.string(),
  minioBucketRecordings: z.string().default('chatvista-recordings'),
  minioBucketDocuments: z.string().default('chatvista-documents'),
  minioBucketAvatars: z.string().default('chatvista-avatars'),

  // Elasticsearch
  elasticsearchUrl: z.string().default('http://localhost:9200'),
  elasticsearchIndexTranscripts: z.string().default('transcripts'),
  elasticsearchIndexMeetings: z.string().default('meetings'),

  // OpenAI
  openaiApiKey: z.string().optional(),
  openaiModel: z.string().default('gpt-4-turbo-preview'),
  openaiWhisperModel: z.string().default('whisper-1'),

  // Azure Speech
  azureSpeechKey: z.string().optional(),
  azureSpeechRegion: z.string().default('eastus'),

  // SMTP
  smtpHost: z.string().default('smtp.gmail.com'),
  smtpPort: z.coerce.number().default(587),
  smtpSecure: z.coerce.boolean().default(false),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpFromName: z.string().default('ChatVista'),
  smtpFromEmail: z.string().default('noreply@chatvista.com'),

  // TURN/STUN
  turnServerUrl: z.string().default('turn:localhost:3478'),
  turnServerUsername: z.string().default('chatvista'),
  turnServerCredential: z.string().default('chatvista_turn_2024'),
  stunServerUrl: z.string().default('stun:stun.l.google.com:19302'),

  // MediaSoup
  mediasoupListenIp: z.string().default('0.0.0.0'),
  mediasoupAnnouncedIp: z.string().default('127.0.0.1'),
  mediasoupMinPort: z.coerce.number().default(40000),
  mediasoupMaxPort: z.coerce.number().default(40100),

  // Logging
  logLevel: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),

  // Rate Limiting
  rateLimitWindowMs: z.coerce.number().default(900000), // 15 minutes
  rateLimitMaxRequests: z.coerce.number().default(100),

  // CORS
  corsOrigins: z.string().default('http://localhost:3000'),

  // Feature Flags
  enableE2eEncryption: z.coerce.boolean().default(true),
  enableAiTranscription: z.coerce.boolean().default(true),
  enableAiMinutes: z.coerce.boolean().default(true),
  enableRecording: z.coerce.boolean().default(true),
  enableWhiteboard: z.coerce.boolean().default(true),
  enablePolls: z.coerce.boolean().default(true),
  enableBreakoutRooms: z.coerce.boolean().default(true),

  // Compliance
  defaultDataRetentionDays: z.coerce.number().default(365),
  enableAuditLogging: z.coerce.boolean().default(true),
  enableGdprCompliance: z.coerce.boolean().default(true),
  enableHipaaCompliance: z.coerce.boolean().default(false),
});

const envConfig = {
  env: process.env.NODE_ENV,
  port: process.env.PORT,
  appName: process.env.APP_NAME,
  appUrl: process.env.APP_URL,
  apiUrl: process.env.API_URL,
  version: process.env.npm_package_version,

  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  redisHost: process.env.REDIS_HOST,
  redisPort: process.env.REDIS_PORT,
  redisPassword: process.env.REDIS_PASSWORD,

  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY,
  jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY,
  sessionSecret: process.env.SESSION_SECRET,
  encryptionKey: process.env.ENCRYPTION_KEY,
  signingKey: process.env.SIGNING_KEY,

  minioEndpoint: process.env.MINIO_ENDPOINT,
  minioPort: process.env.MINIO_PORT,
  minioUseSsl: process.env.MINIO_USE_SSL,
  minioAccessKey: process.env.MINIO_ACCESS_KEY,
  minioSecretKey: process.env.MINIO_SECRET_KEY,
  minioBucketRecordings: process.env.MINIO_BUCKET_RECORDINGS,
  minioBucketDocuments: process.env.MINIO_BUCKET_DOCUMENTS,
  minioBucketAvatars: process.env.MINIO_BUCKET_AVATARS,

  elasticsearchUrl: process.env.ELASTICSEARCH_URL,
  elasticsearchIndexTranscripts: process.env.ELASTICSEARCH_INDEX_TRANSCRIPTS,
  elasticsearchIndexMeetings: process.env.ELASTICSEARCH_INDEX_MEETINGS,

  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL,
  openaiWhisperModel: process.env.OPENAI_WHISPER_MODEL,

  azureSpeechKey: process.env.AZURE_SPEECH_KEY,
  azureSpeechRegion: process.env.AZURE_SPEECH_REGION,

  smtpHost: process.env.SMTP_HOST,
  smtpPort: process.env.SMTP_PORT,
  smtpSecure: process.env.SMTP_SECURE,
  smtpUser: process.env.SMTP_USER,
  smtpPassword: process.env.SMTP_PASSWORD,
  smtpFromName: process.env.SMTP_FROM_NAME,
  smtpFromEmail: process.env.SMTP_FROM_EMAIL,

  turnServerUrl: process.env.TURN_SERVER_URL,
  turnServerUsername: process.env.TURN_SERVER_USERNAME,
  turnServerCredential: process.env.TURN_SERVER_CREDENTIAL,
  stunServerUrl: process.env.STUN_SERVER_URL,

  mediasoupListenIp: process.env.MEDIASOUP_LISTEN_IP,
  mediasoupAnnouncedIp: process.env.MEDIASOUP_ANNOUNCED_IP,
  mediasoupMinPort: process.env.MEDIASOUP_MIN_PORT,
  mediasoupMaxPort: process.env.MEDIASOUP_MAX_PORT,

  logLevel: process.env.LOG_LEVEL,
  rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
  rateLimitMaxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,
  corsOrigins: process.env.CORS_ORIGINS,

  enableE2eEncryption: process.env.ENABLE_E2E_ENCRYPTION,
  enableAiTranscription: process.env.ENABLE_AI_TRANSCRIPTION,
  enableAiMinutes: process.env.ENABLE_AI_MINUTES,
  enableRecording: process.env.ENABLE_RECORDING,
  enableWhiteboard: process.env.ENABLE_WHITEBOARD,
  enablePolls: process.env.ENABLE_POLLS,
  enableBreakoutRooms: process.env.ENABLE_BREAKOUT_ROOMS,

  defaultDataRetentionDays: process.env.DEFAULT_DATA_RETENTION_DAYS,
  enableAuditLogging: process.env.ENABLE_AUDIT_LOGGING,
  enableGdprCompliance: process.env.ENABLE_GDPR_COMPLIANCE,
  enableHipaaCompliance: process.env.ENABLE_HIPAA_COMPLIANCE,
};

const parsed = configSchema.safeParse(envConfig);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(parsed.error.format());
  process.exit(1);
}

const validatedConfig = parsed.data;

export const config = {
  ...validatedConfig,
  cors: {
    origins: validatedConfig.corsOrigins.split(',').map((o) => o.trim()),
  },
  rateLimit: {
    windowMs: validatedConfig.rateLimitWindowMs,
    maxRequests: validatedConfig.rateLimitMaxRequests,
  },
  session: {
    secret: validatedConfig.sessionSecret,
  },
  jwt: {
    secret: validatedConfig.jwtSecret,
    refreshSecret: validatedConfig.jwtRefreshSecret,
    accessExpiry: validatedConfig.jwtAccessExpiry,
    refreshExpiry: validatedConfig.jwtRefreshExpiry,
  },
  storage: {
    endpoint: validatedConfig.minioEndpoint,
    port: validatedConfig.minioPort,
    useSsl: validatedConfig.minioUseSsl,
    accessKey: validatedConfig.minioAccessKey,
    secretKey: validatedConfig.minioSecretKey,
    buckets: {
      recordings: validatedConfig.minioBucketRecordings,
      documents: validatedConfig.minioBucketDocuments,
      avatars: validatedConfig.minioBucketAvatars,
    },
  },
  mediasoup: {
    listenIp: validatedConfig.mediasoupListenIp,
    announcedIp: validatedConfig.mediasoupAnnouncedIp,
    rtcMinPort: validatedConfig.mediasoupMinPort,
    rtcMaxPort: validatedConfig.mediasoupMaxPort,
  },
  webrtc: {
    iceServers: [
      { urls: validatedConfig.stunServerUrl },
      {
        urls: validatedConfig.turnServerUrl,
        username: validatedConfig.turnServerUsername,
        credential: validatedConfig.turnServerCredential,
      },
    ],
  },
  features: {
    e2eEncryption: validatedConfig.enableE2eEncryption,
    aiTranscription: validatedConfig.enableAiTranscription,
    aiMinutes: validatedConfig.enableAiMinutes,
    recording: validatedConfig.enableRecording,
    whiteboard: validatedConfig.enableWhiteboard,
    polls: validatedConfig.enablePolls,
    breakoutRooms: validatedConfig.enableBreakoutRooms,
  },
  compliance: {
    dataRetentionDays: validatedConfig.defaultDataRetentionDays,
    auditLogging: validatedConfig.enableAuditLogging,
    gdpr: validatedConfig.enableGdprCompliance,
    hipaa: validatedConfig.enableHipaaCompliance,
  },
};
