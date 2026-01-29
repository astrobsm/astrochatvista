// ============================================================================
// CHATVISTA - Logger Configuration
// Winston-based logging with structured output
// ============================================================================

import winston from 'winston';
import path from 'path';

// ============================================================================
// Log Format Configuration
// ============================================================================

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  
  if (stack) {
    log += `\n${stack}`;
  }
  
  if (Object.keys(meta).length > 0) {
    log += ` ${JSON.stringify(meta)}`;
  }
  
  return log;
});

// ============================================================================
// Transports
// ============================================================================

const transports: winston.transport[] = [];

// Console transport (always enabled)
transports.push(
  new winston.transports.Console({
    format: combine(
      colorize({ all: true }),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      errors({ stack: true }),
      consoleFormat
    ),
  })
);

// File transports (for production)
if (process.env.NODE_ENV === 'production') {
  const logsDir = process.env.LOGS_DIR || path.join(process.cwd(), 'logs');
  
  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: combine(timestamp(), errors({ stack: true }), json()),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );

  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: combine(timestamp(), errors({ stack: true }), json()),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
    })
  );
}

// ============================================================================
// Logger Instance
// ============================================================================

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: {
    service: 'chatvista-backend',
    version: process.env.npm_package_version || '1.0.0',
  },
  transports,
  exceptionHandlers: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp(), errors({ stack: true }), consoleFormat),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp(), errors({ stack: true }), consoleFormat),
    }),
  ],
});

// ============================================================================
// HTTP Request Logger
// ============================================================================

export const httpLogger = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// ============================================================================
// Stream for Morgan Integration
// ============================================================================

export const loggerStream = {
  write: (message: string) => {
    logger.http(message.substring(0, message.lastIndexOf('\n')));
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

export const logError = (error: Error, context?: Record<string, unknown>) => {
  logger.error(error.message, {
    stack: error.stack,
    ...context,
  });
};

export const logRequest = (
  method: string,
  url: string,
  statusCode: number,
  duration: number,
  userId?: string
) => {
  logger.http(`${method} ${url} ${statusCode} ${duration}ms`, {
    method,
    url,
    statusCode,
    duration,
    userId,
  });
};

export const logAudit = (
  action: string,
  resourceType: string,
  resourceId: string,
  userId: string,
  result: 'success' | 'failure',
  details?: Record<string, unknown>
) => {
  logger.info(`Audit: ${action} ${resourceType}`, {
    action,
    resourceType,
    resourceId,
    userId,
    result,
    ...details,
  });
};

// ============================================================================
// Child Logger Factory
// ============================================================================

export const createChildLogger = (module: string) => {
  return logger.child({ module });
};

export default logger;
