/**
 * Block C9 — Weekly adaptation review, readiness, body metrics, plan change reporting.
 */
const express = require('express');
const { z } = require('zod');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { prisma } = require('../db');
const { logger } = require('../lib/logger');
const { getOrCreateUserSettings } = require('../lib/userSettings');
const { getWeeklyReviewStatus } = require('../lib/adaptation/weeklyReview');
const { runWeeklyAdaptation } = require('../lib/adaptation/runWeeklyAdaptation');
const { recordPlanChange } = require('../lib/adaptation/planChangeLog');
const { emitAdaptationNotification } = require('../lib/adaptation/notifyAdaptation');
const { weekDateOnlyBounds, parseWeekStart } = require('../lib/adaptation/weekBounds');
const { calendarDateOnly } = require('../lib/plans/planCalendar');
const { invalidateDashboardForUser } = require('../lib/dashboardCache');

const router = express.Router();
router.use(authMiddleware);
router.use(requireRole('athlete'));

const readinessSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sleepQuality: z.number().int().min(1).max(5).optional(),
  soreness: z.number().int().min(1).max(5).optional(),
  rpe: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(2000).optional(),
});

const bodyMetricSchema = z.object({
  weightKg: z.number().positive().max(400),
  bodyFatPct: z.number().min(0).max(80).optional(),
  recordedAt: z.string().datetime().optional(),
});

const feedbackSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  rating: z.enum(['up', 'down', 'thumbs_up', 'thumbs_down']),
  reason: z.string().max(2000).optional(),
});

const reportChangeSchema = z.object({
  changeType: z.string().min(1).max(64),
  reason: z.string().max(2000).optional(),
  source: z.enum(['manual', 'chat']).default('manual'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const weeklyCheckinSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  confirmMacro: z.boolean().optional(),
  feedback: feedbackSchema.optional(),
});

router.get('/weekly-review', async (req, res, next) => {
  try {
    const settings = await getOrCreateUserSettings(req.user.id);
    const locale = settings?.language === 'en' ? 'en' : 'ar';
    const status = await getWeeklyReviewStatus(req.user.id, {
      weekStart: req.query.weekStart,
      locale,
    });
    res.json({ review: status });
  } catch (err) {
    logger.error({ err, userId: req.user.id }, 'GET /adaptation/weekly-review failed');
    next(err);
  }
});

router.get('/readiness', async (req, res, next) => {
  try {
    const settings = await getOrCreateUserSettings(req.user.id);
    const timezone = settings?.timezone || 'UTC';
    const days = Math.min(30, Math.max(1, Number(req.query.days) || 7));
    const end = calendarDateOnly(new Date(), timezone);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (days - 1));

    const rows = await prisma.readinessLog.findMany({
      where: {
        userId: req.user.id,
        date: { gte: start, lte: end },
      },
      orderBy: { date: 'desc' },
      take: days,
    });

    res.json({ readiness: rows, days, timezone });
  } catch (err) {
    next(err);
  }
});

router.post('/readiness', validate(readinessSchema), async (req, res, next) => {
  try {
    const settings = await getOrCreateUserSettings(req.user.id);
    const timezone = settings?.timezone || 'UTC';
    const dateOnly = req.body.date
      ? new Date(`${req.body.date}T12:00:00Z`)
      : calendarDateOnly(new Date(), timezone);

    const row = await prisma.readinessLog.upsert({
      where: { userId_date: { userId: req.user.id, date: dateOnly } },
      create: {
        userId: req.user.id,
        date: dateOnly,
        sleepQuality: req.body.sleepQuality ?? null,
        soreness: req.body.soreness ?? null,
        rpe: req.body.rpe ?? null,
        notes: req.body.notes ?? null,
      },
      update: {
        sleepQuality: req.body.sleepQuality ?? undefined,
        soreness: req.body.soreness ?? undefined,
        rpe: req.body.rpe ?? undefined,
        notes: req.body.notes ?? undefined,
      },
    });

    void invalidateDashboardForUser(req.user.id, timezone).catch(() => null);
    res.status(201).json({ readiness: row });
  } catch (err) {
    next(err);
  }
});

router.post('/body-metric', validate(bodyMetricSchema), async (req, res, next) => {
  try {
    const recordedAt = req.body.recordedAt ? new Date(req.body.recordedAt) : new Date();
    const row = await prisma.bodyMetric.create({
      data: {
        userId: req.user.id,
        weightKg: req.body.weightKg,
        bodyFatPct: req.body.bodyFatPct ?? null,
        recordedAt,
      },
    });

    await prisma.athleteProfile.update({
      where: { userId: req.user.id },
      data: { weight: req.body.weightKg },
    }).catch(() => null);

    const settings = await getOrCreateUserSettings(req.user.id);
    void invalidateDashboardForUser(req.user.id, settings?.timezone || 'UTC').catch(() => null);

    res.status(201).json({ bodyMetric: row });
  } catch (err) {
    next(err);
  }
});

router.post('/feedback', validate(feedbackSchema), async (req, res, next) => {
  try {
    const settings = await getOrCreateUserSettings(req.user.id);
    const weekStart = parseWeekStart(req.body.weekStart);
    const { startDateOnly } = weekDateOnlyBounds(weekStart, settings?.timezone || 'UTC');
    const activePlan = await prisma.workoutPlan.findFirst({
      where: { userId: req.user.id, status: 'active' },
      orderBy: { weekStart: 'desc' },
      select: { id: true },
    });

    const row = await prisma.planFeedback.create({
      data: {
        userId: req.user.id,
        weekStart: startDateOnly,
        planId: activePlan?.id ?? null,
        rating: req.body.rating,
        reason: req.body.reason ?? null,
      },
    });
    res.status(201).json({ feedback: row });
  } catch (err) {
    next(err);
  }
});

router.post('/report-change', validate(reportChangeSchema), async (req, res, next) => {
  try {
    const settings = await getOrCreateUserSettings(req.user.id);
    const locale = settings?.language === 'en' ? 'en' : 'ar';
    const row = await recordPlanChange({
      userId: req.user.id,
      changeType: req.body.changeType,
      reason: req.body.reason,
      triggeredBy: req.body.source === 'chat' ? 'chat' : 'manual',
      afterSummary: req.body.date ? { date: req.body.date } : undefined,
      locale,
      notify: true,
    });
    res.status(201).json({ change: row });
  } catch (err) {
    next(err);
  }
});

router.post('/weekly-checkin', validate(weeklyCheckinSchema), async (req, res, next) => {
  try {
    const result = await runWeeklyAdaptation(req.user.id, {
      weekStart: req.body.weekStart,
      confirmMacro: req.body.confirmMacro,
      feedback: req.body.feedback,
    });

    if (!result.ok && result.code === 'MISSING_DATA') {
      return res.status(400).json({
        error: 'Weekly review incomplete',
        code: result.code,
        missing: result.missing,
        review: result.status,
      });
    }

    if (!result.ok && result.code === 'WEEK_NOT_ENDED') {
      return res.status(400).json({
        error: 'Review week not finished yet',
        code: result.code,
        review: result.status,
      });
    }

    res.json({ adaptation: result });
  } catch (err) {
    logger.error({ err, userId: req.user.id }, 'POST /adaptation/weekly-checkin failed');
    next(err);
  }
});

router.post('/confirm-macro', async (req, res, next) => {
  try {
    const result = await runWeeklyAdaptation(req.user.id, {
      weekStart: req.body?.weekStart,
      confirmMacro: true,
    });
    res.json({ adaptation: result });
  } catch (err) {
    next(err);
  }
});

router.post('/evaluate', async (req, res, next) => {
  try {
    const result = await runWeeklyAdaptation(req.user.id, {
      weekStart: req.body?.weekStart,
      skipApply: true,
      feedback: req.body?.feedback,
    });
    res.json({ adaptation: result });
  } catch (err) {
    next(err);
  }
});

/** Cron/worker helper — nudge users with due review */
router.post('/notify-due', async (req, res, next) => {
  try {
    const settings = await getOrCreateUserSettings(req.user.id);
    const locale = settings?.language === 'en' ? 'en' : 'ar';
    const status = await getWeeklyReviewStatus(req.user.id, { locale });
    if (!status.due) {
      return res.json({ notified: false, reason: 'not_due' });
    }
    await emitAdaptationNotification({
      userId: req.user.id,
      kind: 'weekly_review_due',
      locale,
    });
    res.json({ notified: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
