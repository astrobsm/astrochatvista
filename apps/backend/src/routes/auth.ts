// ============================================================================
// CHATVISTA - Authentication Routes
// ============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthService } from '../services/AuthService';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router: Router = Router();
const authService = new AuthService();

// Validation middleware
const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

// ============================================================================
// REGISTRATION
// ============================================================================

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain uppercase, lowercase, number and special character'),
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('organizationName').optional().trim(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, firstName, lastName, organizationName } = req.body;

      const result = await authService.register({
        email,
        password,
        firstName,
        lastName,
        organizationName,
        deviceInfo: {
          userAgent: req.headers['user-agent'],
          ip: req.ip,
        },
      });

      logger.info(`User registered: ${email}`);

      res.status(201).json({
        message: 'Registration successful. Please verify your email.',
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// LOGIN
// ============================================================================

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, rememberMe } = req.body;

      const result = await authService.login({
        email,
        password,
        rememberMe,
        deviceInfo: {
          userAgent: req.headers['user-agent'],
          ip: req.ip,
        },
      });

      // Set refresh token in HTTP-only cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000, // 30 or 7 days
      });

      logger.info(`User logged in: ${email}`);

      res.json({
        message: 'Login successful',
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// LOGOUT
// ============================================================================

router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (refreshToken) {
      await authService.logout(req.user!.id, refreshToken);
    }

    res.clearCookie('refreshToken');

    logger.info(`User logged out: ${req.user!.email}`);

    res.json({ message: 'Logout successful' });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// REFRESH TOKEN
// ============================================================================

router.post('/refresh', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token required' });
      return;
    }

    const result = await authService.refreshTokens(refreshToken, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// VERIFY EMAIL
// ============================================================================

router.post(
  '/verify-email',
  [body('token').notEmpty().withMessage('Verification token is required')],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.body;

      await authService.verifyEmail(token);

      res.json({ message: 'Email verified successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// FORGOT PASSWORD
// ============================================================================

router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail().withMessage('Valid email is required')],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;

      await authService.forgotPassword(email);

      // Always return success to prevent email enumeration
      res.json({ message: 'If the email exists, a password reset link has been sent.' });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// RESET PASSWORD
// ============================================================================

router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain uppercase, lowercase, number and special character'),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, password } = req.body;

      await authService.resetPassword(token, password);

      res.json({ message: 'Password reset successful' });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// CHANGE PASSWORD
// ============================================================================

router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain uppercase, lowercase, number and special character'),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = req.body;

      await authService.changePassword(req.user!.id, currentPassword, newPassword);

      logger.info(`Password changed for user: ${req.user!.email}`);

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET CURRENT USER
// ============================================================================

router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getCurrentUser(req.user!.id);

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// ENABLE MFA
// ============================================================================

router.post('/mfa/enable', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.enableMFA(req.user!.id);

    res.json({
      message: 'Scan the QR code with your authenticator app',
      qrCode: result.qrCode,
      secret: result.secret, // Only for manual entry
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// VERIFY MFA
// ============================================================================

router.post(
  '/mfa/verify',
  authenticate,
  [body('code').isLength({ min: 6, max: 6 }).withMessage('Valid 6-digit code required')],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code } = req.body;

      await authService.verifyMFA(req.user!.id, code);

      res.json({ message: 'MFA enabled successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// DISABLE MFA
// ============================================================================

router.post(
  '/mfa/disable',
  authenticate,
  [body('code').isLength({ min: 6, max: 6 }).withMessage('Valid 6-digit code required')],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code } = req.body;

      await authService.disableMFA(req.user!.id, code);

      res.json({ message: 'MFA disabled successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// SSO CALLBACK
// ============================================================================

router.post('/sso/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider, token, userData } = req.body;

    const result = await authService.handleSSOCallback(provider, token, userData, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };
