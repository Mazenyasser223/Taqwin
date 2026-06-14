/**
 * Block C5 — DailyAthletePlan: slice active weekly plans into one row per calendar day.
 */
const { prisma } = require('../../db');
const { logger } = require('../logger');
const { getOrCreateUserSettings } = require('../userSettings');
const { invalidateContextBundle } = require('../contextBundle');
const { calendarDateOnly, addCalendarDays } = require('./planCalendar');
const { planDayIndexInPlanWeek, weekStartSundayUtc } = require('./planWeek');

const workoutDaysInclude = {
  orderBy: { dayIndex: 'asc' },
  include: {
    exercises: {
      orderBy: { sortOrder: 'asc' },
      include: { exercise: { select: { id: true, name: true, nameAr: true, category: true } } },
    },
  },
};

const dietDaysInclude = {
  orderBy: { dayIndex: 'asc' },
  include: {
    meals: {
      orderBy: { mealType: 'asc' },
      include: {
        items: {
          include: {
            foodItem: {
              select: { id: true, name: true, calories: true, protein: true, carbs: true, fat: true },
            },
          },
        },
      },
    },
  },
};

const dailyPlanInclude = {
  workoutPlanDay: {
    include: workoutDaysInclude.include,
  },
  dietPlanDay: {
    include: dietDaysInclude.include,
  },
};

async function loadActivePlanDays(userId, { detailed = false } = {}) {
  const [workoutPlan, dietPlan] = await Promise.all([
    prisma.workoutPlan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { weekStart: 'desc' },
      include: { days: detailed ? workoutDaysInclude : { orderBy: { dayIndex: 'asc' } } },
    }),
    prisma.dietPlan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { weekStart: 'desc' },
      include: { days: detailed ? dietDaysInclude : { orderBy: { dayIndex: 'asc' } } },
    }),
  ]);
  return { workoutPlan, dietPlan };
}

/**
 * Ensure the athlete has an active workout plan shell so manual/routine edits always have a target.
 * @param {string} userId
 * @param {{ date?: Date, timezone?: string }} [opts]
 */
async function ensureActiveWorkoutPlanShell(userId, opts = {}) {
  const { workoutPlan } = await loadActivePlanDays(userId);
  if (workoutPlan) return workoutPlan;

  const settings = await getOrCreateUserSettings(userId);
  const when = opts.date || new Date();
  const locale = settings?.language === 'en' ? 'en' : 'ar';
  const weekStart = weekStartSundayUtc(when);

  return prisma.workoutPlan.create({
    data: {
      userId,
      weekStart,
      status: 'active',
      source: 'manual',
      explainabilityText:
        locale === 'en'
          ? 'Your flexible plan — add or apply routines on any day.'
          : 'خطتك المرنة — أضف أو طبّق الروتين في أي يوم.',
      locale,
      days: {
        create: [1, 2, 3, 4, 5, 6, 7].map((dayIndex) => ({
          dayIndex,
          focus: null,
          isRestDay: true,
        })),
      },
    },
    include: { days: { orderBy: { dayIndex: 'asc' } } },
  });
}

/**
 * Upsert DailyAthletePlan for one calendar date.
 * @param {string} userId
 * @param {{ date?: Date, dateOnly?: Date, timezone?: string, explainabilityText?: string }} [opts]
 */
async function ensureDailyAthletePlanForDate(userId, opts = {}) {
  if (!userId) throw new Error('ensureDailyAthletePlanForDate: userId required');

  const settings = await getOrCreateUserSettings(userId);
  const timezone = opts.timezone || settings?.timezone || 'UTC';
  const when = opts.date || new Date();
  const dateOnly = opts.dateOnly || calendarDateOnly(when, timezone);

  const { workoutPlan, dietPlan } = await loadActivePlanDays(userId);
  if (!workoutPlan && !dietPlan) {
    return { ok: false, reason: 'no_active_plan', date: dateOnly, dayIndex: 0 };
  }

  const planWeekStart = workoutPlan?.weekStart || dietPlan?.weekStart || weekStartSundayUtc(when);
  const weekStartOnly = calendarDateOnly(
    new Date(planWeekStart.getTime() + 12 * 60 * 60 * 1000),
    timezone
  );
  const dayIndex = planDayIndexInPlanWeek(when, weekStartOnly, timezone);

  const workoutDay = workoutPlan?.days?.find((d) => d.dayIndex === dayIndex) || null;
  const dietDay = dietPlan?.days?.find((d) => d.dayIndex === dayIndex) || null;

  const explain =
    opts.explainabilityText?.trim() ||
    workoutPlan?.explainabilityText ||
    dietPlan?.explainabilityText ||
    null;

  const row = await prisma.dailyAthletePlan.upsert({
    where: {
      userId_date: { userId, date: dateOnly },
    },
    create: {
      userId,
      date: dateOnly,
      workoutPlanDayId: workoutDay?.id ?? null,
      dietPlanDayId: dietDay?.id ?? null,
      status: 'active',
      explainabilityText: explain,
    },
    update: {
      workoutPlanDayId: workoutDay?.id ?? null,
      dietPlanDayId: dietDay?.id ?? null,
      status: 'active',
      ...(explain ? { explainabilityText: explain } : {}),
    },
    include: dailyPlanInclude,
  });

  return {
    ok: true,
    dailyPlan: row,
    date: dateOnly,
    dayIndex,
    workoutPlanDayId: workoutDay?.id ?? null,
    dietPlanDayId: dietDay?.id ?? null,
  };
}

/**
 * Materialize daily rows for N consecutive calendar days starting today (user TZ).
 * @param {string} userId
 * @param {{ days?: number, timezone?: string, startDate?: Date }} [opts]
 */
async function ensureDailyAthletePlansForWeek(userId, opts = {}) {
  const settings = await getOrCreateUserSettings(userId);
  const timezone = opts.timezone || settings?.timezone || 'UTC';
  const days = Math.max(1, Math.min(Number(opts.days) || 7, 14));
  const start = calendarDateOnly(opts.startDate || new Date(), timezone);

  const results = [];
  for (let i = 0; i < days; i += 1) {
    const dateOnly = addCalendarDays(start, i);
    const probe = new Date(dateOnly.getTime() + 12 * 60 * 60 * 1000);
    const r = await ensureDailyAthletePlanForDate(userId, {
      date: probe,
      dateOnly,
      timezone,
    });
    results.push(r);
  }

  const created = results.filter((r) => r.ok).length;
  logger.info({ userId, days, created, timezone }, 'DailyAthletePlan week slice ensured');
  return { ok: created > 0, created, total: days, results };
}

/**
 * After weekly plan persist/regenerate — slice current week (non-blocking for caller).
 * @param {string} userId
 * @param {{ timezone?: string, days?: number }} [opts]
 */
async function syncDailyPlansAfterWeeklyPlan(userId, opts = {}) {
  try {
    const slice = await ensureDailyAthletePlansForWeek(userId, opts);
    if (slice.ok) {
      await invalidateContextBundle(userId);
    }
    return slice;
  } catch (err) {
    logger.warn({ err: err.message, userId }, 'syncDailyPlansAfterWeeklyPlan failed');
    return { ok: false, error: err.message };
  }
}

/**
 * @param {string} userId
 * @param {Date} [date]
 */
async function fetchDailyAthletePlanForDate(userId, date = new Date()) {
  const settings = await getOrCreateUserSettings(userId);
  const timezone = settings?.timezone || 'UTC';
  const dateOnly = calendarDateOnly(date, timezone);

  return prisma.dailyAthletePlan.findUnique({
    where: { userId_date: { userId, date: dateOnly } },
    include: dailyPlanInclude,
  });
}

/**
 * Daily rows for a calendar range (inclusive).
 * @param {string} userId
 * @param {Date} startDateOnly
 * @param {Date} endDateOnly
 */
async function fetchDailyAthletePlansInRange(userId, startDateOnly, endDateOnly) {
  return prisma.dailyAthletePlan.findMany({
    where: {
      userId,
      date: { gte: startDateOnly, lte: endDateOnly },
    },
    orderBy: { date: 'asc' },
    include: dailyPlanInclude,
  });
}

/**
 * Resolve today's plan row (fetch or materialize).
 * @param {string} userId
 * @param {Date} [date]
 */
async function resolveTodayPlan(userId, date = new Date()) {
  const settings = await getOrCreateUserSettings(userId);
  const timezone = settings?.timezone || 'UTC';
  const dateOnly = calendarDateOnly(date, timezone);
  const { workoutPlan, dietPlan } = await loadActivePlanDays(userId);
  const planWeekStart = workoutPlan?.weekStart || dietPlan?.weekStart || weekStartSundayUtc(date);
  const weekStartOnly = calendarDateOnly(
    new Date(planWeekStart.getTime() + 12 * 60 * 60 * 1000),
    timezone
  );
  const dayIndex = planDayIndexInPlanWeek(date, weekStartOnly, timezone);

  let dailyPlan = await fetchDailyAthletePlanForDate(userId, date);
  if (!dailyPlan) {
    const ensured = await ensureDailyAthletePlanForDate(userId, { date, dateOnly, timezone });
    if (!ensured.ok) {
      return { ok: false, reason: ensured.reason || 'no_plan', timezone, date: dateOnly, dayIndex };
    }
    dailyPlan = ensured.dailyPlan;
  }

  return {
    ok: true,
    dailyPlan,
    workoutPlan,
    dietPlan,
    timezone,
    date: dateOnly,
    dayIndex,
    planWeekStart: weekStartOnly.toISOString().slice(0, 10),
  };
}

module.exports = {
  ensureDailyAthletePlanForDate,
  ensureDailyAthletePlansForWeek,
  syncDailyPlansAfterWeeklyPlan,
  fetchDailyAthletePlanForDate,
  fetchDailyAthletePlansInRange,
  resolveTodayPlan,
  loadActivePlanDays,
  ensureActiveWorkoutPlanShell,
};
