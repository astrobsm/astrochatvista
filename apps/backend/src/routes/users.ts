// ============================================================================
// CHATVISTA - User Routes
// API endpoints for user management
// ============================================================================

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

const router: Router = Router();

// ============================================================================
// CURRENT USER
// ============================================================================

// Get current user profile
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        organization: true,
        department: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove sensitive fields
    const { passwordHash, mfaSecret, ...safeUser } = user;

    res.json(safeUser);
  } catch (error) {
    return next(error);
  }
});

// Update current user profile
router.patch('/me', authenticate, async (req, res, next) => {
  try {
    const { name, avatar, timezone, language, settings } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(name && { name }),
        ...(avatar && { avatar }),
        ...(timezone && { timezone }),
        ...(language && { language }),
        ...(settings && { settings }),
        updatedAt: new Date(),
      },
    });

    const { passwordHash, mfaSecret, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    return next(error);
  }
});

// Change password
router.post('/me/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { passwordHash },
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    return next(error);
  }
});

// Get user preferences
router.get('/me/preferences', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        settings: true,
        timezone: true,
        language: true,
      },
    });

    res.json(user);
  } catch (error) {
    return next(error);
  }
});

// Update user preferences
router.patch('/me/preferences', authenticate, async (req, res, next) => {
  try {
    const { settings, timezone, language } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(settings && { settings }),
        ...(timezone && { timezone }),
        ...(language && { language }),
      },
      select: {
        settings: true,
        timezone: true,
        language: true,
      },
    });

    res.json(user);
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// USER MANAGEMENT (Admin)
// ============================================================================

// List users in organization
router.get('/', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return res.json({ users: [], total: 0 });
    }

    const { search, role, status, departmentId, limit, offset } = req.query;

    const where: any = { organizationId: user.organizationId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;
    if (status) where.status = status;
    if (departmentId) where.departmentId = departmentId;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          status: true,
          department: true,
          createdAt: true,
          lastLogin: true,
        },
        take: limit ? parseInt(limit as string) : 50,
        skip: offset ? parseInt(offset as string) : 0,
        orderBy: { name: 'asc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total });
  } catch (error) {
    return next(error);
  }
});

// Get user by ID
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        department: true,
        organization: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { passwordHash, mfaSecret, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    return next(error);
  }
});

// Create user (Admin only)
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    const { email, name, password, role, departmentId } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, name, and password are required' });
    }

    // Check if email exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: role || 'USER',
        organizationId: currentUser!.organizationId,
        departmentId,
        status: 'ACTIVE',
        emailVerified: true, // Admin-created users are pre-verified
      },
    });

    const { passwordHash: _, mfaSecret, ...safeUser } = user;
    res.status(201).json(safeUser);
  } catch (error) {
    return next(error);
  }
});

// Update user (Admin only)
router.patch('/:id', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    const { name, role, status, departmentId } = req.body;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(role && { role }),
        ...(status && { status }),
        ...(departmentId !== undefined && { departmentId }),
        updatedAt: new Date(),
      },
    });

    const { passwordHash, mfaSecret, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    return next(error);
  }
});

// Delete user (Admin only)
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    // Prevent self-deletion
    if (req.params.id === req.user!.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await prisma.user.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    return next(error);
  }
});

// Suspend user (Admin only)
router.post('/:id/suspend', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    const { reason } = req.body;

    await prisma.user.update({
      where: { id: req.params.id },
      data: {
        status: 'SUSPENDED',
        suspendedAt: new Date(),
        suspendReason: reason,
      },
    });

    res.json({ message: 'User suspended' });
  } catch (error) {
    return next(error);
  }
});

// Reactivate user (Admin only)
router.post('/:id/reactivate', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: {
        status: 'ACTIVE',
        suspendedAt: null,
        suspendReason: null,
      },
    });

    res.json({ message: 'User reactivated' });
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// USER SEARCH
// ============================================================================

// Search users (for mentions, assignments, etc.)
router.get('/search', authenticate, async (req, res, next) => {
  try {
    const { q, limit } = req.query;

    if (!q || (q as string).length < 2) {
      return res.json([]);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    const users = await prisma.user.findMany({
      where: {
        organizationId: user?.organizationId,
        status: 'ACTIVE',
        OR: [
          { name: { contains: q as string, mode: 'insensitive' } },
          { email: { contains: q as string, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      },
      take: limit ? parseInt(limit as string) : 10,
    });

    res.json(users);
  } catch (error) {
    return next(error);
  }
});

export default router;
