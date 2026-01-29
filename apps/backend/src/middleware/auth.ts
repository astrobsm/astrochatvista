// ============================================================================
// CHATVISTA - Authentication Middleware
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { AppError } from './errorHandler';
import { logger } from '../utils/logger';

const authService = new AuthService();

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401);
    }

    const token = authHeader.substring(7);

    // Verify token
    const payload = await authService.verifyAccessToken(token);

    // Attach user to request
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      organizationId: payload.organizationId,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    logger.error('Authentication error:', error);
    next(new AppError('Invalid or expired token', 401));
  }
};

// Role-based authorization
export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403));
    }

    next();
  };
};

// Organization access check
export const requireOrganization = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user?.organizationId) {
    return next(new AppError('Organization access required', 403));
  }
  next();
};

// Resource ownership check
export const requireOwnership = (
  resourceOrgIdPath: string = 'params.organizationId'
) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parts = resourceOrgIdPath.split('.');
    let resourceOrgId: any = req;
    
    for (const part of parts) {
      resourceOrgId = resourceOrgId?.[part];
    }

    if (!resourceOrgId) {
      return next(new AppError('Resource not found', 404));
    }

    // Super admin can access all
    if (req.user?.role === 'SUPER_ADMIN') {
      return next();
    }

    // Check organization match
    if (req.user?.organizationId !== resourceOrgId) {
      return next(new AppError('Access denied', 403));
    }

    next();
  };
};

// Admin role check
export const requireAdmin = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const adminRoles = ['SUPER_ADMIN', 'ORG_ADMIN', 'DEPT_ADMIN'];
  
  if (!req.user || !adminRoles.includes(req.user.role)) {
    return next(new AppError('Admin access required', 403));
  }
  
  next();
};

// Host role check for meetings
export const requireHostRole = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const hostRoles = ['SUPER_ADMIN', 'ORG_ADMIN', 'HOST', 'CO_HOST'];
  
  if (!req.user || !hostRoles.includes(req.user.role)) {
    return next(new AppError('Host privileges required', 403));
  }
  
  next();
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = await authService.verifyAccessToken(token);

      req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        organizationId: payload.organizationId,
      };
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// API Key authentication for webhooks and integrations
export const authenticateApiKey = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new AppError('API key required', 401);
    }

    // Validate API key (implement proper API key storage/validation)
    // This is a placeholder - implement proper API key management
    const isValid = await validateApiKey(apiKey);

    if (!isValid) {
      throw new AppError('Invalid API key', 401);
    }

    next();
  } catch (error) {
    next(error);
  }
};

async function validateApiKey(apiKey: string): Promise<boolean> {
  // Implement API key validation against database
  // This is a placeholder
  return apiKey.length > 0;
}
