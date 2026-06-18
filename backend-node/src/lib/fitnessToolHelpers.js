/**
 * Shared helpers for coach fitness tools (hydration, workouts, onboarding patches).
 */
const { prisma } = require('../db');
const { calendarDateOnly } = require('./plans/planCalendar');
const { resolveTodayPlan, loadActivePlanDays, fetchDailyAthletePlansInRange } = require('./plans/dailyAthletePlanService');
const { formatWeekPlanResponse } = require('./plans/planApiFormat');
const { weekStartSundayUtc } = require('./plans/planWeek');
const { weekDateOnlyBounds, parseWeekStart } = require('./adaptation/weekBounds');
const { recordPlanChange } = require('./adaptation/planChangeLog');
const { enqueuePlanGenerate, isPlanQueueEnabled } = require('../jobs/planGenerateJobs');
const { generatePlanForUser } = require('./plans/generator');
const { loggedAtRangeFromDateKeys } = require('./athleteMetrics');

const PLAN_SESSION_TITLE = 'Taqwin Plan Session';

function normalizeStringArray(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : String(raw).split(/[,،;|]/);
  return list.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
}

async function mergeAthleteOnboarding(userId, patch) {
  const profile = await prisma.athleteProfile.findUnique({ where: { userId } });
  const current =
    profile?.onboardingData && typeof profile.onboardingData === 'object'
      ? { ...profile.onboardingData }
      : {};
  const next = { ...current, ...patch };
  await prisma.athleteProfile.upsert({
    where: { userId },
    create: { userId, onboardingData: next },
    update: { onboardingData: next },
  });
  return next;
}

async function getOrCreatePlanSessionWorkout() {
  let row = await prisma.workout.findFirst({
    where: { title: PLAN_SESSION_TITLE, isPublic: true },
  });
  if (row) return row;
  row = await prisma.workout.create({
    data: {
      title: PLAN_SESSION_TITLE,
      category: 'Strength',
      difficulty: 'Intermediate',
      durationMin: 45,
      calories: 250,
      description: 'System workout template for AI plan session logs',
      isPublic: true,
    },
  });
  return row;
}

async function sumHydrationMlForDate(userId, dateKey) {
  const { start, end } = loggedAtRangeFromDateKeys(dateKey, dateKey);
  const agg = await prisma.hydrationLog.aggregate({
    where: { userId, loggedAt: { gte: start, lte: end } },
    _sum: { ml: true },
  });
  return agg._sum.ml ?? 0;
}

async function logHydrationMl(userId, ml, loggedAt) {
  const amount = Math.round(Number(ml));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 5000) {
    throw new Error('ml must be between 1 and 5000');
  }
  const row = await prisma.hydrationLog.create({
    data: {
      userId,
      ml: amount,
      ...(loggedAt ? { loggedAt: new Date(loggedAt) } : {}),
    },
  });
  return row;
}

async function createPlanWorkoutLog(userId, { durationMin, notes, dailyPlanId, dateKey }) {
  const workout = await getOrCreatePlanSessionWorkout();
  const noteParts = [
    notes || null,
    dailyPlanId ? `dailyPlanId=${dailyPlanId}` : null,
    dateKey ? `planDate=${dateKey}` : null,
  ].filter(Boolean);
  return prisma.workoutLog.create({
    data: {
      userId,
      workoutId: workout.id,
      durationMin: Number.isFinite(Number(durationMin)) ? Math.round(Number(durationMin)) : 45,
      notes: noteParts.join(' | ').slice(0, 1000) || null,
    },
    include: { workout: { select: { id: true, title: true, calories: true, durationMin: true } } },
  }).then((log) => {
    const { afterWorkoutActivityLogged } = require('./notifications/fitnessNotificationHooks');
    void afterWorkoutActivityLogged(userId);
    return log;
  });
}

async function markDailyPlanCompleted(userId, timezone, { reason, durationMin, notes } = {}) {
  const resolved = await resolveTodayPlan(userId);
  if (!resolved.ok) throw new Error('No active plan for today');

  const dateOnly = resolved.date;
  const dateKey = dateOnly.toISOString().slice(0, 10);

  const row = await prisma.dailyAthletePlan.upsert({
    where: { userId_date: { userId, date: dateOnly } },
    create: {
      userId,
      date: dateOnly,
      workoutPlanDayId: resolved.dailyPlan?.workoutPlanDayId ?? null,
      dietPlanDayId: resolved.dailyPlan?.dietPlanDayId ?? null,
      status: 'completed',
      aiNotes: reason || notes || 'Completed from coach',
      adaptedFromProgress: false,
    },
    update: {
      status: 'completed',
      aiNotes: reason || notes || 'Completed from coach',
    },
  });

  const workoutLog = await createPlanWorkoutLog(userId, {
    durationMin,
    notes: notes || reason || 'Plan workout completed',
    dailyPlanId: row.id,
    dateKey,
  });

  return { dailyPlan: row, workoutLog, date: dateKey, timezone };
}

async function submitPlanFeedback(userId, input = {}) {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const timezone = settings?.timezone || 'UTC';
  const weekStart = parseWeekStart(input.weekStart);
  const { startDateOnly } = weekDateOnlyBounds(weekStart, timezone);

  let rating = String(input.rating || input.feedback || '').toLowerCase();
  if (rating === 'thumbs_up' || rating === 'positive' || rating === 'good') rating = 'up';
  if (rating === 'thumbs_down' || rating === 'negative' || rating === 'bad') rating = 'down';
  if (rating !== 'up' && rating !== 'down') {
    throw new Error('rating must be up or down');
  }

  const activePlan = await prisma.workoutPlan.findFirst({
    where: { userId, status: 'active' },
    orderBy: { weekStart: 'desc' },
    select: { id: true },
  });

  const row = await prisma.planFeedback.create({
    data: {
      userId,
      weekStart: startDateOnly,
      planId: activePlan?.id ?? null,
      rating,
      reason: input.reason ? String(input.reason).slice(0, 2000) : null,
    },
  });
  return { feedback: row };
}

async function getBodyMetricHistory(userId, days = 30) {
  const limit = Math.min(90, Math.max(1, Number(days) || 30));
  const rows = await prisma.bodyMetric.findMany({
    where: { userId },
    orderBy: { recordedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      weightKg: true,
      bodyFatPct: true,
      measurements: true,
      recordedAt: true,
    },
  });
  return { metrics: rows, count: rows.length };
}

async function getWorkoutWeekForUser(userId) {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const timezone = settings?.timezone || 'UTC';
  const { workoutPlan, dietPlan } = await loadActivePlanDays(userId, { detailed: true });
  if (!workoutPlan && !dietPlan) throw new Error('No active weekly plan');

  const weekStart = weekStartSundayUtc(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const dailyPlans = await fetchDailyAthletePlansInRange(userId, weekStart, weekEnd);

  const week = formatWeekPlanResponse({ workoutPlan, dietPlan, dailyPlans });
  return { week, timezone };
}

async function logMealFromPlan(userId, mealType = 'lunch') {
  const resolved = await resolveTodayPlan(userId);
  if (!resolved.ok) throw new Error('No active plan for today');
  const dayId = resolved.dailyPlan?.dietPlanDayId;
  if (!dayId) throw new Error('Today has no diet plan');

  const slot = String(mealType || 'lunch').toLowerCase();
  const meal = await prisma.dietPlanMeal.findFirst({
    where: { dayId, mealType: slot },
    include: { items: { include: { foodItem: true } } },
  });
  if (!meal?.items?.length) throw new Error(`No ${slot} meal on today's plan`);

  const logs = [];
  for (const item of meal.items) {
    if (!item.foodItemId) continue;
    const grams = Number(item.quantity) || 100;
    const log = await prisma.foodLog.create({
      data: { userId, foodItemId: item.foodItemId, grams },
      include: { foodItem: { select: { id: true, name: true } } },
    });
    logs.push(log);
  }
  if (!logs.length) throw new Error('No loggable food items on that meal');
  return { mealType: slot, logs, count: logs.length };
}

async function requestDeloadWeek(userId, input = {}, locale = 'ar') {
  const reason = String(input.reason || input.message || 'Deload week requested from coach').slice(
    0,
    500
  );
  await recordPlanChange({
    userId,
    changeType: 'deload_week',
    reason,
    triggeredBy: 'chat',
    afterSummary: { action: 'deload_requested' },
    locale,
    notify: true,
  });

  const { timezone } = { timezone: (await prisma.userSettings.findUnique({ where: { userId } }))?.timezone || 'UTC' };
  const dateOnly = calendarDateOnly(new Date(), timezone);
  await prisma.dailyAthletePlan.upsert({
    where: { userId_date: { userId, date: dateOnly } },
    create: {
      userId,
      date: dateOnly,
      status: 'adapted',
      lifeMode: 'normal',
      aiNotes: reason,
      explainabilityText: locale === 'ar' ? 'أسبوع تخفيف — حجم وت intensity مخفّضين' : 'Deload week — reduced volume and intensity',
      adaptedFromProgress: true,
    },
    update: {
      status: 'adapted',
      aiNotes: reason,
      explainabilityText: locale === 'ar' ? 'أسبوع تخفيف — حجم وت intensity مخفّضين' : 'Deload week — reduced volume and intensity',
      adaptedFromProgress: true,
    },
  });

  return {
    ok: true,
    message:
      locale === 'ar'
        ? 'تم تسجيل طلب أسبوع التخفيف — سيتم تطبيق التعديلات في المراجعة الأسبوعية'
        : 'Deload week request recorded — adjustments apply on weekly review',
    reason,
  };
}

async function adjustMacroTargets(userId, input = {}) {
  const calories = input.calories ?? input.calorieTarget;
  const protein = input.protein ?? input.proteinTarget;
  const carbs = input.carbs ?? input.carbTarget;
  const fat = input.fat ?? input.fatTarget;

  const patch = {};
  if (calories != null && Number.isFinite(Number(calories))) patch.calorieTarget = Math.round(Number(calories));
  if (protein != null && Number.isFinite(Number(protein))) patch.proteinTarget = Math.round(Number(protein));
  if (carbs != null && Number.isFinite(Number(carbs))) patch.carbTarget = Math.round(Number(carbs));
  if (fat != null && Number.isFinite(Number(fat))) patch.fatTarget = Math.round(Number(fat));
  if (!Object.keys(patch).length) throw new Error('Provide at least one of calories, protein, carbs, fat');

  await mergeAthleteOnboarding(userId, patch);

  const dietPlan = await prisma.dietPlan.findFirst({
    where: { userId, status: 'active' },
    orderBy: { weekStart: 'desc' },
  });
  if (dietPlan) {
    await prisma.dietPlan.update({
      where: { id: dietPlan.id },
      data: {
        ...(patch.calorieTarget != null ? { targetCalories: patch.calorieTarget } : {}),
        ...(patch.proteinTarget != null ? { targetProteinG: patch.proteinTarget } : {}),
        ...(patch.carbTarget != null ? { targetCarbsG: patch.carbTarget } : {}),
        ...(patch.fatTarget != null ? { targetFatG: patch.fatTarget } : {}),
      },
    });
  }

  return { ok: true, targets: patch, dietPlanId: dietPlan?.id ?? null };
}

async function regenerateWeeklyPlan(userId, { locale, regenerationReason, source }) {
  if (isPlanQueueEnabled()) {
    const enq = await enqueuePlanGenerate({
      userId,
      locale,
      regenerationReason,
      source,
    });
    if (enq.ok) {
      return { ok: true, queued: true, jobId: enq.jobId, duplicate: enq.duplicate ?? false };
    }
  }
  const result = await generatePlanForUser({ userId, locale, regenerationReason });
  return { ok: true, queued: false, ...result };
}

module.exports = {
  PLAN_SESSION_TITLE,
  normalizeStringArray,
  mergeAthleteOnboarding,
  getOrCreatePlanSessionWorkout,
  sumHydrationMlForDate,
  logHydrationMl,
  createPlanWorkoutLog,
  markDailyPlanCompleted,
  submitPlanFeedback,
  getBodyMetricHistory,
  getWorkoutWeekForUser,
  logMealFromPlan,
  requestDeloadWeek,
  adjustMacroTargets,
  regenerateWeeklyPlan,
};
