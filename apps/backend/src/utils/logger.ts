// ============================================================================
// CHATVISTA - Winston Logger Configuration
// ============================================================================

import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Custom format for development
const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  if (stack) {
    log += `\n${stack}`;
  }
  if (Object.keys(meta).length > 0) {
    log += `\n${JSON.stringify(meta, null, 2)}`;
  }
  return log;
});

// Create logger instance
export const logger = winston.createLogger({
  level: config.logLevel,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' })
  ),
  defaultMeta: { service: 'chatvista-api' },
  transports: [],
});

// Development configuration
if (config.env === 'development') {
  logger.add(
    new winston.transports.Console({
      format: combine(colorize({ all: true }), devFormat),
    })
  );
} else {
  // Production configuration
  logger.add(
    new winston.transports.Console({
      format: combine(json()),
    })
  );

  // File transports for production
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: combine(json()),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );

  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: combine(json()),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
    })
  );
}

// Stream for Morgan HTTP logging
logger.stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
} as any;

export default logger;
