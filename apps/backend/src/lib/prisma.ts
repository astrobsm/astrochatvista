// ============================================================================
// CHATVISTA - Prisma Database Client
// ============================================================================

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });

// Logging middleware
prisma.$on('query' as never, (e: any) => {
  if (process.env.NODE_ENV === 'development' && process.env.LOG_QUERIES === 'true') {
    logger.debug(`Query: ${e.query}`);
    logger.debug(`Params: ${e.params}`);
    logger.debug(`Duration: ${e.duration}ms`);
  }
});

prisma.$on('error' as never, (e: any) => {
  logger.error('Prisma Error:', e);
});

prisma.$on('warn' as never, (e: any) => {
  logger.warn('Prisma Warning:', e);
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;
