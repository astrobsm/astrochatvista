// ============================================================================
// CHATVISTA - Analytics Routes
// API endpoints for analytics and reporting
// ============================================================================

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { AnalyticsService } from '../services/AnalyticsService';
import { prisma } from '../lib/prisma';

const router: Router = Router();
const analyticsService = new AnalyticsService();

// ============================================================================
// ORGANIZATION ANALYTICS
// ============================================================================

// Get organization dashboard
router.get('/dashboard', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const { from, to } = req.query;
    const dateRange = from && to
      ? { from: new Date(from as string), to: new Date(to as string) }
      : undefined;

    const dashboard = await analyticsService.getOrganizationDashboard(
      user.organizationId,
      dateRange
    );

    res.json(dashboard);
  } catch (error) {
    return next(error);
  }
});

// Get meeting statistics
router.get('/meetings', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const { from, to } = req.query;
    const dateRange = {
      from: from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      to: to ? new Date(to as string) : new Date(),
    };

    const stats = await analyticsService.getMeetingStats(
      user.organizationId,
      dateRange
    );

    res.json(stats);
  } catch (error) {
    return next(error);
  }
});

// Get user statistics
router.get('/users', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const { from, to } = req.query;
    const dateRange = {
      from: from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      to: to ? new Date(to as string) : new Date(),
    };

    const stats = await analyticsService.getUserStats(
      user.organizationId,
      dateRange
    );

    res.json(stats);
  } catch (error) {
    return next(error);
  }
});

// Get engagement statistics
router.get('/engagement', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const { from, to } = req.query;
    const dateRange = {
      from: from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      to: to ? new Date(to as string) : new Date(),
    };

    const stats = await analyticsService.getEngagementStats(
      user.organizationId,
      dateRange
    );

    res.json(stats);
  } catch (error) {
    return next(error);
  }
});

// Get trends
router.get('/trends', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const { from, to } = req.query;
    const dateRange = {
      from: from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      to: to ? new Date(to as string) : new Date(),
    };

    const trends = await analyticsService.getTrends(
      user.organizationId,
      dateRange
    );

    res.json(trends);
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// MEETING ANALYTICS
// ============================================================================

// Get analytics for a specific meeting
router.get('/meeting/:meetingId', authenticate, async (req, res, next) => {
  try {
    // Verify access
    const participant = await prisma.participant.findFirst({
      where: {
        meetingId: req.params.meetingId,
        userId: req.user!.id,
      },
    });

    if (!participant && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const analytics = await analyticsService.getMeetingAnalytics(
      req.params.meetingId
    );

    res.json(analytics);
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// USER ANALYTICS
// ============================================================================

// Get analytics for current user
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const dateRange = from && to
      ? { from: new Date(from as string), to: new Date(to as string) }
      : undefined;

    const analytics = await analyticsService.getUserAnalytics(
      req.user!.id,
      dateRange
    );

    res.json(analytics);
  } catch (error) {
    return next(error);
  }
});

// Get analytics for a specific user (admin only)
router.get('/user/:userId', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const dateRange = from && to
      ? { from: new Date(from as string), to: new Date(to as string) }
      : undefined;

    const analytics = await analyticsService.getUserAnalytics(
      req.params.userId,
      dateRange
    );

    res.json(analytics);
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// REPORTS
// ============================================================================

// Generate report
router.post('/reports/generate', authenticate, authorize('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const { reportType, from, to, includeUserBreakdown, includeDepartmentBreakdown } = req.body;

    const report = await analyticsService.generateReport(
      user.organizationId,
      reportType || 'monthly',
      {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        includeUserBreakdown,
        includeDepartmentBreakdown,
      }
    );

    res.json(report);
  } catch (error) {
    return next(error);
  }
});

// Get pre-defined reports
router.get('/reports/:type', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const validTypes = ['weekly', 'monthly', 'quarterly'];
    if (!validTypes.includes(req.params.type)) {
      return res.status(400).json({ error: 'Invalid report type' });
    }

    const report = await analyticsService.generateReport(
      user.organizationId,
      req.params.type as 'weekly' | 'monthly' | 'quarterly'
    );

    res.json(report);
  } catch (error) {
    return next(error);
  }
});

export default router;
