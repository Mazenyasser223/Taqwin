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
  ensureDailyAthletePlanForDate,
  ensureActiveWorkoutPlanShell,
} = require('../lib/plans/dailyAthletePlanService');
const { formatTodayPlanResponse, formatWeekPlanResponse } = require('../lib/plans/planApiFormat');
const { weekStartSundayUtc } = require('../lib/plans/planWeek');
const { calendarDateOnly, addCalendarDays } = require('../lib/plans/planCalendar');
const { getOrCreateUserSettings } = require('../lib/userSettings');
const { z } = require('zod');
const { validate } = require('../middleware/validate');
const { prisma } = require('../db');
const { recordPlanChange } = require('../lib/adaptation/planChangeLog');
const { invalidateDashboardForUser } = require('../lib/dashboardCache');
const { assertUserCanEditPlanStructure } = require('../lib/plans/planEditPolicy');

const patchDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['active', 'skipped', 'completed', 'adapted']).optional(),
  lifeMode: z.enum(['normal', 'travel', 'sick', 'fasting', 'injury_flare']).optional(),
  reason: z.string().max(500).optional(),
});

const routineExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  sets: z.number().int().min(1).max(100).optional().nullable(),
  reps: z.union([z.string().max(40), z.number().int().min(1).max(1000)]).optional().nullable(),
  restSec: z.number().int().min(0).max(3600).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

const routineCreateSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1).max(200),
      focus: z.string().trim().max(120).optional().nullable(),
      notes: z.string().trim().max(1000).optional().nullable(),
      sourceDayId: z.string().uuid().optional().nullable(),
      sourceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      exercises: z.array(routineExerciseSchema).max(40).optional(),
    })
    .refine((body) => body.sourceDayId || body.sourceDate || (body.exercises && body.exercises.length), {
      message: 'Provide sourceDayId, sourceDate, or exercises',
    }),
});

const routineUpdateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      name: z.string().trim().min(1).max(200).optional(),
      focus: z.string().trim().max(120).optional().nullable(),
      notes: z.string().trim().max(1000).optional().nullable(),
      exercises: z.array(routineExerciseSchema).min(1).max(40).optional(),
    })
    .refine((body) => Object.keys(body).length > 0, { message: 'Provide at least one field' }),
});

const idParam = z.object({ params: z.object({ id: z.string().uuid() }) });

const routineApplySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mode: z.enum(['replace', 'append']),
  }),
});

const routineAdviceSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  query: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
});

const router = express.Router();
router.use(authMiddleware);
router.use(requireRole('athlete'));

function plansStorageReady() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

const routineInclude = {
  exercises: {
    orderBy: { sortOrder: 'asc' },
    include: { exercise: { select: { id: true, name: true, nameAr: true, category: true } } },
  },
};

function serializeRoutine(routine) {
  return {
    ...routine,
    exerciseCount: routine.exercises?.length || 0,
    exercises: (routine.exercises || []).map((row) => ({
      id: row.id,
      exerciseId: row.exerciseId,
      name: row.exercise?.name || 'Exercise',
      nameAr: row.exercise?.nameAr ?? null,
      category: row.exercise?.category ?? null,
      sets: row.sets ?? 3,
      reps: row.reps || '10',
      restSec: row.restSec ?? 90,
      notes: row.notes || '',
      sortOrder: row.sortOrder,
    })),
  };
}

function routineExerciseCreateRows(exercises) {
  return exercises.map((exercise, index) => ({
    exerciseId: exercise.exerciseId,
    sortOrder: index,
    sets: exercise.sets ?? null,
    reps: exercise.reps == null ? null : String(exercise.reps),
    restSec: exercise.restSec ?? null,
    notes: exercise.notes || null,
  }));
}

async function ensureExercisesExist(exercises) {
  const ids = [...new Set(exercises.map((exercise) => exercise.exerciseId))];
  const found = await prisma.exercise.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const foundIds = new Set(found.map((exercise) => exercise.id));
  const missing = ids.filter((id) => !foundIds.has(id));
  if (missing.length) {
    const err = new Error('One or more exercises were not found');
    err.status = 404;
    throw err;
  }
}

async function exercisesFromSource(userId, body) {
  if (body.exercises?.length) {
    await ensureExercisesExist(body.exercises);
    return { sourceDayId: body.sourceDayId || null, focus: body.focus || null, exercises: body.exercises };
  }

  let dayId = body.sourceDayId || null;
  if (!dayId && body.sourceDate) {
    const target = await resolveTargetWorkoutDay(userId, body.sourceDate);
    dayId = target.day.id;
  }

  const day = await prisma.workoutPlanDay.findFirst({
    where: { id: dayId, plan: { userId } },
    include: {
      exercises: {
        orderBy: { sortOrder: 'asc' },
        include: { exercise: true },
      },
    },
  });
  if (!day) {
    const err = new Error('Workout day not found');
    err.status = 404;
    throw err;
  }
  return {
    sourceDayId: day.id,
    focus: body.focus || day.focus || null,
    exercises: day.exercises.map((row) => ({
      exerciseId: row.exerciseId,
      sets: row.sets,
      reps: row.reps,
      restSec: row.restSec,
      notes: row.notes,
    })),
  };
}

async function resolveTargetWorkoutDay(userId, dateStr) {
  const settings = await getOrCreateUserSettings(userId);
  const timezone = settings?.timezone || 'UTC';
  const date = new Date(`${dateStr}T12:00:00.000Z`);

  await ensureActiveWorkoutPlanShell(userId, { date, timezone });

  const ensured = await ensureDailyAthletePlanForDate(userId, { date, timezone });
  if (!ensured.ok) {
    const err = new Error('Could not prepare workout day');
    err.status = 500;
    throw err;
  }

  let day = ensured.workoutPlanDayId
    ? await prisma.workoutPlanDay.findFirst({
        where: { id: ensured.workoutPlanDayId, plan: { userId } },
        include: { exercises: { orderBy: { sortOrder: 'asc' } }, plan: true },
      })
    : null;

  if (!day) {
    const { workoutPlan } = await loadActivePlanDays(userId);
    if (!workoutPlan) {
      const err = new Error('Could not prepare workout day');
      err.status = 500;
      throw err;
    }
    day = await prisma.workoutPlanDay.findFirst({
      where: { planId: workoutPlan.id, dayIndex: ensured.dayIndex },
      include: { exercises: { orderBy: { sortOrder: 'asc' } }, plan: true },
    });
    if (!day) {
      day = await prisma.workoutPlanDay.create({
        data: {
          planId: workoutPlan.id,
          dayIndex: ensured.dayIndex,
          focus: null,
          isRestDay: true,
        },
        include: { exercises: { orderBy: { sortOrder: 'asc' } }, plan: true },
      });
    }
    await prisma.dailyAthletePlan.update({
      where: { userId_date: { userId, date: ensured.date } },
      data: { workoutPlanDayId: day.id },
    });
  }

  return { day, date: ensured.date, timezone };
}

async function loadOwnedRoutine(userId, id) {
  return prisma.savedWorkoutRoutine.findFirst({
    where: { id, userId },
    include: routineInclude,
  });
}

router.get('/routines', async (req, res, next) => {
  try {
    if (!plansStorageReady()) {
      return res.status(503).json({ error: 'Plan storage unavailable' });
    }
    const routines = await prisma.savedWorkoutRoutine.findMany({
      where: { userId: req.user.id },
      include: routineInclude,
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    res.json(routines.map(serializeRoutine));
  } catch (err) {
    next(err);
  }
});

router.post('/routines', validate(routineCreateSchema), async (req, res, next) => {
  try {
    if (!plansStorageReady()) {
      return res.status(503).json({ error: 'Plan storage unavailable' });
    }
    const source = await exercisesFromSource(req.user.id, req.body);
    if (!source.exercises.length) {
      return res.status(400).json({ error: 'Cannot save a routine without exercises' });
    }
    const rows = routineExerciseCreateRows(source.exercises);
    const routine = await prisma.savedWorkoutRoutine.create({
      data: {
        userId: req.user.id,
        sourceDayId: source.sourceDayId,
        name: req.body.name,
        focus: source.focus,
        notes: req.body.notes || null,
        exercises: { create: rows },
      },
      include: routineInclude,
    });
    res.status(201).json(serializeRoutine(routine));
  } catch (err) {
    next(err);
  }
});

router.get('/routines/:id', validate(idParam), async (req, res, next) => {
  try {
    const routine = await loadOwnedRoutine(req.user.id, req.params.id);
    if (!routine) return res.status(404).json({ error: 'Routine not found' });
    res.json(serializeRoutine(routine));
  } catch (err) {
    next(err);
  }
});

router.patch('/routines/:id', validate(routineUpdateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.savedWorkoutRoutine.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Routine not found' });

    if (req.body.exercises) await ensureExercisesExist(req.body.exercises);
    const data = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.focus !== undefined) data.focus = req.body.focus || null;
    if (req.body.notes !== undefined) data.notes = req.body.notes || null;

    const routine = await prisma.$transaction(async (tx) => {
      if (req.body.exercises) {
        await tx.savedWorkoutRoutineExercise.deleteMany({ where: { routineId: existing.id } });
        data.exercises = { create: routineExerciseCreateRows(req.body.exercises) };
      }
      return tx.savedWorkoutRoutine.update({
        where: { id: existing.id },
        data,
        include: routineInclude,
      });
    });
    res.json(serializeRoutine(routine));
  } catch (err) {
    next(err);
  }
});

router.delete('/routines/:id', validate(idParam), async (req, res, next) => {
  try {
    const existing = await prisma.savedWorkoutRoutine.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Routine not found' });
    await prisma.savedWorkoutRoutine.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/routines/:id/advice', validate(routineAdviceSchema), async (req, res, next) => {
  try {
    const routine = await loadOwnedRoutine(req.user.id, req.params.id);
    if (!routine) return res.status(404).json({ error: 'Routine not found' });
    const target = await resolveTargetWorkoutDay(req.user.id, req.query.date);
    const existingIds = new Set(target.day.exercises.map((exercise) => exercise.exerciseId));
    const duplicateCount = routine.exercises.filter((exercise) => existingIds.has(exercise.exerciseId)).length;
    const newCount = routine.exercises.length - duplicateCount;
    const recommendMode = target.day.exercises.length === 0 || duplicateCount > newCount ? 'replace' : 'append';
    const reason =
      recommendMode === 'replace'
        ? 'Replace is cleaner because the target day is empty or overlaps heavily with this routine.'
        : 'Append fits because most routine exercises are not already on the target day.';
    res.json({
      routineId: routine.id,
      date: req.query.date,
      recommendMode,
      duplicateCount,
      newCount,
      targetExerciseCount: target.day.exercises.length,
      reason,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/routines/:id/apply', validate(routineApplySchema), async (req, res, next) => {
  try {
    const settings = await getOrCreateUserSettings(req.user.id);
    const locale = settings?.language === 'en' ? 'en' : 'ar';
    try {
      await assertUserCanEditPlanStructure(req.user.id, locale);
    } catch (err) {
      if (err.code === 'PLAN_AGENT_ONLY') {
        return res.status(403).json({ code: err.code, error: err.message });
      }
      throw err;
    }

    const routine = await loadOwnedRoutine(req.user.id, req.params.id);
    if (!routine) return res.status(404).json({ error: 'Routine not found' });
    const target = await resolveTargetWorkoutDay(req.user.id, req.body.date);
    const existingIds = new Set(target.day.exercises.map((exercise) => exercise.exerciseId));
    const duplicateExerciseIds = routine.exercises
      .filter((exercise) => existingIds.has(exercise.exerciseId))
      .map((exercise) => exercise.exerciseId);
    const rows =
      req.body.mode === 'append'
        ? routine.exercises.filter((exercise) => !existingIds.has(exercise.exerciseId))
        : routine.exercises;

    if (req.body.mode === 'append' && rows.length === 0) {
      return res.json({
        routineId: routine.id,
        date: req.body.date,
        mode: req.body.mode,
        added: 0,
        duplicateExerciseIds,
        message: 'All exercises from this routine are already on the target day.',
        day: target.day,
      });
    }

    const startOrder = req.body.mode === 'append' ? target.day.exercises.length : 0;
    const createdRows = rows.map((exercise, index) => ({
      dayId: target.day.id,
      exerciseId: exercise.exerciseId,
      sortOrder: startOrder + index,
      sets: exercise.sets,
      reps: exercise.reps,
      restSec: exercise.restSec,
      notes: exercise.notes,
    }));

    await prisma.$transaction(async (tx) => {
      if (req.body.mode === 'replace') {
        await tx.workoutPlanExercise.deleteMany({ where: { dayId: target.day.id } });
      }
      if (createdRows.length) await tx.workoutPlanExercise.createMany({ data: createdRows });
      await tx.workoutPlanDay.update({
        where: { id: target.day.id },
        data: { focus: routine.focus || target.day.focus, isRestDay: false },
      });
      await tx.dailyAthletePlan.update({
        where: { userId_date: { userId: req.user.id, date: target.date } },
        data: {
          workoutPlanDayId: target.day.id,
          status: 'adapted',
          adaptedFromProgress: true,
          aiNotes: `Applied routine "${routine.name}" (${req.body.mode}).`,
        },
      });
    });

    await recordPlanChange({
      userId: req.user.id,
      changeType: 'manual_edit',
      reason: `Applied saved routine "${routine.name}" with ${req.body.mode} mode`,
      triggeredBy: 'manual',
      afterSummary: {
        date: req.body.date,
        routineId: routine.id,
        mode: req.body.mode,
        added: createdRows.length,
        duplicatesSkipped: duplicateExerciseIds.length,
      },
      locale,
      notify: true,
    });
    void invalidateDashboardForUser(req.user.id, target.timezone).catch(() => null);

    const day = await prisma.workoutPlanDay.findUnique({
      where: { id: target.day.id },
      include: { exercises: { orderBy: { sortOrder: 'asc' }, include: { exercise: true } } },
    });
    res.json({
      routineId: routine.id,
      date: req.body.date,
      mode: req.body.mode,
      added: createdRows.length,
      duplicateExerciseIds,
      day,
    });
  } catch (err) {
    next(err);
  }
});

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

    void invalidateDashboardForUser(req.user.id, timezone).catch(() => null);

    res.json({ day: row });
  } catch (err) {
    logger.error({ err, userId: req.user.id }, 'PATCH /plans/day failed');
    next(err);
  }
});

module.exports = router;
