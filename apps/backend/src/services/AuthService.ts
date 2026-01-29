// ============================================================================
// CHATVISTA - Authentication Service
// ============================================================================

import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma';
import { cache } from '../lib/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { EmailService } from './EmailService';
import { AuditService } from './AuditService';
import { AppError } from '../middleware/errorHandler';

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName?: string;
  deviceInfo: {
    userAgent?: string;
    ip?: string;
  };
}

interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
  deviceInfo: {
    userAgent?: string;
    ip?: string;
  };
}

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  organizationId: string;
  type: 'access' | 'refresh';
}

export class AuthService {
  private emailService: EmailService;
  private auditService: AuditService;
  private jwtSecret: Uint8Array;
  private jwtRefreshSecret: Uint8Array;

  constructor() {
    this.emailService = new EmailService();
    this.auditService = new AuditService();
    this.jwtSecret = new TextEncoder().encode(config.jwt.secret);
    this.jwtRefreshSecret = new TextEncoder().encode(config.jwt.refreshSecret);
  }

  // ============================================================================
  // REGISTRATION
  // ============================================================================

  async register(input: RegisterInput) {
    const { email, password, firstName, lastName, organizationName, deviceInfo } = input;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError('Email already registered', 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create organization if name provided, or use default
    let organization = await prisma.organization.findFirst({
      where: { domain: 'default.chatvista.com' },
    });

    if (organizationName) {
      const domain = `${organizationName.toLowerCase().replace(/\s+/g, '-')}.chatvista.com`;
      organization = await prisma.organization.create({
        data: {
          name: organizationName,
          domain,
          subscriptionTier: 'FREE',
        },
      });
    } else if (!organization) {
      organization = await prisma.organization.create({
        data: {
          name: 'Default Organization',
          domain: 'default.chatvista.com',
          subscriptionTier: 'FREE',
        },
      });
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`,
        role: organizationName ? 'ORG_ADMIN' : 'PARTICIPANT',
        organizationId: organization.id,
        preferences: {
          noiseSuppressionLevel: 'AUTO',
          captionsEnabled: false,
          captionsLanguage: 'en-US',
          hdVideoEnabled: true,
          mirrorSelfView: true,
          autoJoinAudio: true,
          muteOnEntry: false,
          notificationsEnabled: true,
        },
      },
    });

    // Generate verification token
    const verificationToken = nanoid(32);
    await cache.set(`email-verify:${verificationToken}`, user.id, 24 * 60 * 60); // 24 hours

    // Send verification email
    await this.emailService.sendVerificationEmail(email, firstName, verificationToken);

    // Audit log
    await this.auditService.log({
      actorId: user.id,
      actorRole: user.role,
      actorIp: deviceInfo.ip,
      actorDevice: deviceInfo.userAgent,
      action: 'CREATE',
      resourceType: 'USER',
      resourceId: user.id,
      resourceName: email,
      result: 'SUCCESS',
      organizationId: organization.id,
    });

    logger.info(`New user registered: ${email}`);

    return { user };
  }

  // ============================================================================
  // LOGIN
  // ============================================================================

  async login(input: LoginInput) {
    const { email, password, deviceInfo } = input;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    });

    if (!user || !user.passwordHash) {
      throw new AppError('Invalid email or password', 401);
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError('Account is temporarily locked. Please try again later.', 423);
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash);

    if (!validPassword) {
      // Increment failed attempts
      const failedAttempts = user.failedLoginAttempts + 1;
      const updateData: any = { failedLoginAttempts: failedAttempts };

      // Lock account after 5 failed attempts
      if (failedAttempts >= 5) {
        updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        logger.warn(`Account locked due to failed attempts: ${email}`);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      await this.auditService.log({
        actorId: user.id,
        actorRole: user.role,
        actorIp: deviceInfo.ip,
        actorDevice: deviceInfo.userAgent,
        action: 'LOGIN',
        resourceType: 'USER',
        resourceId: user.id,
        resourceName: email,
        result: 'FAILURE',
        organizationId: user.organizationId,
        details: { reason: 'Invalid password' },
      });

      throw new AppError('Invalid email or password', 401);
    }

    // Check if email is verified (optional enforcement)
    if (!user.emailVerified && config.env === 'production') {
      throw new AppError('Please verify your email before logging in', 403);
    }

    // Check user status
    if (user.status !== 'ACTIVE') {
      throw new AppError('Account is not active', 403);
    }

    // Reset failed attempts and update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: deviceInfo.ip,
      },
    });

    // Generate tokens
    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user, deviceInfo);

    // Audit log
    await this.auditService.log({
      actorId: user.id,
      actorRole: user.role,
      actorIp: deviceInfo.ip,
      actorDevice: deviceInfo.userAgent,
      action: 'LOGIN',
      resourceType: 'USER',
      resourceId: user.id,
      resourceName: email,
      result: 'SUCCESS',
      organizationId: user.organizationId,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiry(config.jwt.accessExpiry),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
        preferences: user.preferences,
      },
    };
  }

  // ============================================================================
  // TOKEN MANAGEMENT
  // ============================================================================

  private async generateAccessToken(user: any): Promise<string> {
    return new SignJWT({
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      type: 'access',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(config.jwt.accessExpiry)
      .setIssuer('chatvista')
      .setAudience('chatvista-api')
      .sign(this.jwtSecret);
  }

  private async generateRefreshToken(user: any, deviceInfo: any): Promise<string> {
    const tokenId = nanoid(32);
    const expiresAt = new Date(Date.now() + this.parseExpiry(config.jwt.refreshExpiry) * 1000);

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId: user.id,
        token: tokenId,
        deviceInfo,
        ipAddress: deviceInfo.ip,
        expiresAt,
      },
    });

    return new SignJWT({
      sub: user.id,
      jti: tokenId,
      type: 'refresh',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(config.jwt.refreshExpiry)
      .setIssuer('chatvista')
      .sign(this.jwtRefreshSecret);
  }

  async refreshTokens(refreshToken: string, deviceInfo: any) {
    try {
      // Verify refresh token
      const { payload } = await jwtVerify(refreshToken, this.jwtRefreshSecret, {
        issuer: 'chatvista',
      });

      const tokenId = payload.jti as string;

      // Find and validate stored token
      const storedToken = await prisma.refreshToken.findUnique({
        where: { id: tokenId },
        include: { user: { include: { organization: true } } },
      });

      if (!storedToken || storedToken.revokedAt) {
        throw new AppError('Invalid refresh token', 401);
      }

      if (storedToken.expiresAt < new Date()) {
        throw new AppError('Refresh token expired', 401);
      }

      const user = storedToken.user;

      // Revoke old token
      await prisma.refreshToken.update({
        where: { id: tokenId },
        data: { revokedAt: new Date() },
      });

      // Generate new tokens
      const accessToken = await this.generateAccessToken(user);
      const newRefreshToken = await this.generateRefreshToken(user, deviceInfo);

      return {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: this.parseExpiry(config.jwt.accessExpiry),
      };
    } catch (error) {
      throw new AppError('Invalid refresh token', 401);
    }
  }

  async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      const { payload } = await jwtVerify(token, this.jwtSecret, {
        issuer: 'chatvista',
        audience: 'chatvista-api',
      });

      return payload as unknown as TokenPayload;
    } catch (error) {
      throw new AppError('Invalid access token', 401);
    }
  }

  // ============================================================================
  // LOGOUT
  // ============================================================================

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      try {
        const { payload } = await jwtVerify(refreshToken, this.jwtRefreshSecret);
        const tokenId = payload.jti as string;

        await prisma.refreshToken.update({
          where: { id: tokenId },
          data: { revokedAt: new Date() },
        });
      } catch (error) {
        // Token already invalid, continue
      }
    }

    // Clear user session cache
    await cache.flushPattern(`session:${userId}:*`);
  }

  async logoutAll(userId: string) {
    // Revoke all refresh tokens
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Clear all session caches
    await cache.flushPattern(`session:${userId}:*`);
  }

  // ============================================================================
  // EMAIL VERIFICATION
  // ============================================================================

  async verifyEmail(token: string) {
    const userId = await cache.get<string>(`email-verify:${token}`);

    if (!userId) {
      throw new AppError('Invalid or expired verification token', 400);
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    await cache.del(`email-verify:${token}`);

    logger.info(`Email verified for user: ${userId}`);
  }

  // ============================================================================
  // PASSWORD RESET
  // ============================================================================

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });

    // Don't reveal if email exists
    if (!user) {
      return;
    }

    const resetToken = nanoid(32);
    await cache.set(`password-reset:${resetToken}`, user.id, 60 * 60); // 1 hour

    await this.emailService.sendPasswordResetEmail(email, user.firstName, resetToken);

    logger.info(`Password reset requested for: ${email}`);
  }

  async resetPassword(token: string, newPassword: string) {
    const userId = await cache.get<string>(`password-reset:${token}`);

    if (!userId) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Revoke all refresh tokens
    await this.logoutAll(userId);

    await cache.del(`password-reset:${token}`);

    logger.info(`Password reset for user: ${userId}`);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.passwordHash) {
      throw new AppError('User not found', 404);
    }

    const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!validPassword) {
      throw new AppError('Current password is incorrect', 401);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Revoke all other sessions
    await this.logoutAll(userId);
  }

  // ============================================================================
  // MFA
  // ============================================================================

  async enableMFA(userId: string) {
    // Generate TOTP secret
    const secret = nanoid(32);

    // Store temporary secret until verified
    await cache.set(`mfa-setup:${userId}`, secret, 10 * 60); // 10 minutes

    // Generate QR code URL
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const otpauthUrl = `otpauth://totp/ChatVista:${user?.email}?secret=${secret}&issuer=ChatVista`;

    return {
      secret,
      qrCode: otpauthUrl, // Frontend will generate QR from this
    };
  }

  async verifyMFA(userId: string, code: string) {
    const secret = await cache.get<string>(`mfa-setup:${userId}`);

    if (!secret) {
      throw new AppError('MFA setup expired. Please start again.', 400);
    }

    // Verify TOTP code (simplified - use speakeasy or otplib in production)
    const isValid = this.verifyTOTP(secret, code);

    if (!isValid) {
      throw new AppError('Invalid verification code', 400);
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaSecret: secret, // Encrypt this in production
      },
    });

    await cache.del(`mfa-setup:${userId}`);
  }

  async disableMFA(userId: string, code: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user?.mfaSecret) {
      throw new AppError('MFA is not enabled', 400);
    }

    const isValid = this.verifyTOTP(user.mfaSecret, code);

    if (!isValid) {
      throw new AppError('Invalid verification code', 400);
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
      },
    });
  }

  private verifyTOTP(_secret: string, code: string): boolean {
    // Simplified TOTP verification - use proper library in production
    // This is a placeholder - implement with otplib or speakeasy
    return code.length === 6 && /^\d+$/.test(code);
  }

  // ============================================================================
  // SSO
  // ============================================================================

  async handleSSOCallback(_provider: string, _token: string, userData: any, deviceInfo: any) {
    // Find or create user based on SSO data
    let user = await prisma.user.findUnique({
      where: { email: userData.email },
      include: { organization: true },
    });

    if (!user) {
      // Create new user from SSO
      const organization = await prisma.organization.findFirst({
        where: { domain: 'default.chatvista.com' },
      });

      if (!organization) {
        throw new AppError('Organization not found', 404);
      }

      user = await prisma.user.create({
        data: {
          email: userData.email,
          firstName: userData.firstName || userData.email.split('@')[0],
          lastName: userData.lastName || '',
          displayName: userData.displayName || userData.email,
          avatarUrl: userData.avatarUrl,
          role: 'PARTICIPANT',
          organizationId: organization.id,
          emailVerified: true,
          emailVerifiedAt: new Date(),
          preferences: {},
        },
        include: { organization: true },
      });
    }

    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user, deviceInfo);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiry(config.jwt.accessExpiry),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        role: user.role,
      },
    };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true, department: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        logoUrl: user.organization.logoUrl,
      },
      department: user.department
        ? {
            id: user.department.id,
            name: user.department.name,
          }
        : null,
      preferences: user.preferences,
      mfaEnabled: user.mfaEnabled,
      emailVerified: user.emailVerified,
    };
  }

  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // Default 15 minutes

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 900;
    }
  }
}
