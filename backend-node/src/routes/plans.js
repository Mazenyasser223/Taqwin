/**
 * Block C6 — Athlete plan read APIs (Postgres + DailyAthletePlan).
 *
 *   GET /api/plans/today   Today's plan (daily row + workout/diet joins)
 *   GET /api/plans/week    Active weekly workout + diet plans
 */
const express = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { logger } = require('../lib/logger');
const {
  resolveTodayPlan,
  loadActivePlanDays,
  fetchDailyAthletePlansInRange,
} = require('../lib/plans/dailyAthletePlanService');
const { formatTodayPlanResponse, formatWeekPlanResponse } = require('../lib/plans/planApiFormat');
const { weekStartSundayUtc } = require('../lib/plans/planWeek');
const { calendarDateOnly, addCalendarDays } = require('../lib/plans/planCalendar');
const { getOrCreateUserSettings } = require('../lib/userSettings');
const { z } = require('zod');
const { validate } = require('../middleware/validate');
const { prisma } = require('../db');
const { recordPlanChange } = require('../lib/adaptation/planChangeLog');

const patchDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['active', 'skipped', 'completed', 'adapted']).optional(),
  lifeMode: z.enum(['normal', 'travel', 'sick', 'fasting', 'injury_flare']).optional(),
  reason: z.string().max(500).optional(),
});

const router = express.Router();
router.use(authMiddleware);
router.use(requireRole('athlete'));

function plansStorageReady() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

router.get('/today', async (req, res, next) => {
  try {
    if (!plansStorageReady()) {
      return res.status(503).json({ error: 'Plan storage unavailable' });
    }

    const resolved = await resolveTodayPlan(req.user.id);
    if (!resolved.ok) {
      return res.status(404).json({
        error: 'No active plan for today',
        reason: resolved.reason,
      });
    }

    const body = formatTodayPlanResponse({
      dailyPlan: resolved.dailyPlan,
      dayIndex: resolved.dayIndex,
      date: resolved.date,
      timezone: resolved.timezone,
      workoutPlan: resolved.workoutPlan,
      dietPlan: resolved.dietPlan,
    });

    res.json({ plan: body });
  } catch (err) {
    logger.error({ err, userId: req.user.id }, 'GET /plans/today failed');
    next(err);
  }
});

router.get('/week', async (req, res, next) => {
  try {
    if (!plansStorageReady()) {
      return res.status(503).json({ error: 'Plan storage unavailable' });
    }

    const { workoutPlan, dietPlan } = await loadActivePlanDays(req.user.id, { detailed: true });
    if (!workoutPlan && !dietPlan) {
      return res.status(404).json({ error: 'No active weekly plan' });
    }

    const settings = await getOrCreateUserSettings(req.user.id);
    const timezone = settings?.timezone || 'UTC';
    const planWeekStartRaw = workoutPlan?.weekStart || dietPlan?.weekStart;
    const weekStartDate = planWeekStartRaw
      ? calendarDateOnly(new Date(planWeekStartRaw.getTime() + 12 * 60 * 60 * 1000), timezone)
      : calendarDateOnly(weekStartSundayUtc(new Date()), timezone);
    const weekEndDate = addCalendarDays(weekStartDate, 6);

    const dailyPlans = await fetchDailyAthletePlansInRange(
      req.user.id,
      weekStartDate,
      weekEndDate
    );

    const week = formatWeekPlanResponse({ workoutPlan, dietPlan, dailyPlans });
    res.json({ week });
  } catch (err) {
    logger.error({ err, userId: req.user.id }, 'GET /plans/week failed');
    next(err);
  }
});

router.patch('/day', validate(patchDaySchema), async (req, res, next) => {
  try {
    if (!plansStorageReady()) {
      return res.status(503).json({ error: 'Plan storage unavailable' });
    }

    const settings = await getOrCreateUserSettings(req.user.id);
    const timezone = settings?.timezone || 'UTC';
    const locale = settings?.language === 'en' ? 'en' : 'ar';
    const dateOnly = req.body.date
      ? new Date(`${req.body.date}T12:00:00Z`)
      : calendarDateOnly(new Date(), timezone);

    const data = {};
    if (req.body.status) data.status = req.body.status;
    if (req.body.lifeMode) data.lifeMode = req.body.lifeMode;
    if (req.body.reason) data.aiNotes = req.body.reason;

    const row = await prisma.dailyAthletePlan.upsert({
      where: { userId_date: { userId: req.user.id, date: dateOnly } },
      create: {
        userId: req.user.id,
        date: dateOnly,
        status: req.body.status || 'active',
        lifeMode: req.body.lifeMode || 'normal',
        aiNotes: req.body.reason || null,
        adaptedFromProgress: true,
      },
      update: data,
    });

    const changeType = req.body.status === 'skipped' ? 'skip_day' : 'manual_edit';
    await recordPlanChange({
      userId: req.user.id,
      changeType,
      reason: req.body.reason,
      triggeredBy: 'manual',
      afterSummary: { date: dateOnly.toISOString().slice(0, 10), status: row.status, lifeMode: row.lifeMode },
      locale,
      notify: true,
    });

    res.json({ day: row });
  } catch (err) {
    logger.error({ err, userId: req.user.id }, 'PATCH /plans/day failed');
    next(err);
  }
});

module.exports = router;
