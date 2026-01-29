// ============================================================================
// CHATVISTA - Error Handler Middleware
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { config } from '../config';
import { ZodError } from 'zod';

// Prisma error types (avoiding direct import due to generation issues)
interface PrismaError extends Error {
  code?: string;
}

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;
  public details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Default error values
  let statusCode = 500;
  let message = 'Internal Server Error';
  let code = 'INTERNAL_ERROR';
  let details: any = undefined;

  // Handle known error types
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code || 'APP_ERROR';
    details = err.details;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation Error';
    code = 'VALIDATION_ERROR';
    details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  } else if (err.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as PrismaError;
    switch (prismaErr.code) {
      case 'P2002':
        statusCode = 409;
        message = 'A record with this value already exists';
        code = 'DUPLICATE_ENTRY';
        break;
      case 'P2025':
        statusCode = 404;
        message = 'Record not found';
        code = 'NOT_FOUND';
        break;
      case 'P2003':
        statusCode = 400;
        message = 'Invalid reference';
        code = 'INVALID_REFERENCE';
        break;
      default:
        message = 'Database error';
        code = 'DATABASE_ERROR';
    }
  } else if (err.name === 'PrismaClientValidationError') {
    statusCode = 400;
    message = 'Invalid data provided';
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  }

  // Log error
  const logData = {
    requestId: req.id,
    method: req.method,
    path: req.path,
    statusCode,
    code,
    message: err.message,
    stack: err.stack,
    userId: req.user?.id,
  };

  if (statusCode >= 500) {
    logger.error('Server Error:', logData);
  } else {
    logger.warn('Client Error:', logData);
  }

  // Send response
  const response: any = {
    error: {
      code,
      message,
      ...(details && { details }),
      ...(config.env === 'development' && {
        stack: err.stack,
      }),
    },
    requestId: req.id,
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(response);
};

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const error = new AppError(`Route ${req.method} ${req.path} not found`, 404, 'NOT_FOUND');
  next(error);
};

// Async handler wrapper to catch errors
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
