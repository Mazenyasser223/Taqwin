/**
 * Block A5 — Context-Augmented Generation (CAG) bundle for FastAPI.
 * Built in Node, cached in Redis `cag:{userId}`.
 */
const { prisma } = require('../db');
const { redisGetJson, redisSetJson, redisDel } = require('./redis');
const { getOrCreateUserSettings } = require('./userSettings');
const { estimateTargets, ageFromDateOfBirth } = require('./nutritionTargets');
const { extractOnboardingNutrition } = require('./coachContext');
const {
  fetchActivePlan,
  todayDietDay,
  todayWorkoutDay,
} = require('../services/activePlanService');

const DEFAULT_CAG_TTL_MS = 10 * 60 * 1000;

function utcDayStart(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function dayBounds(dateStr) {
  const start = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : utcDayStart();
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function cagCacheKey(userId) {
  return `cag:${userId}`;
}

function getCagCacheTtlMs() {
  const n = Number(process.env.CAG_CACHE_TTL_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CAG_TTL_MS;
}

function asRow(row) {
  return row && typeof row === 'object' && !Array.isArray(row) ? row : null;
}

function summarizeFoodLog(log) {
  const fi = log.foodItem;
  const factor = (log.grams ?? 0) / 100;
  return {
    name: fi?.name ?? 'Unknown',
    grams: log.grams,
    calories: Math.round((fi?.calories ?? 0) * factor),
    protein: Math.round((fi?.protein ?? 0) * factor * 10) / 10,
    carbs: Math.round((fi?.carbs ?? 0) * factor * 10) / 10,
    fat: Math.round((fi?.fat ?? 0) * factor * 10) / 10,
    fdcId: fi?.fdcId ?? null,
    loggedAt: log.loggedAt,
  };
}

function buildNutritionToday(today, todayLogs, targets) {
  const totals = todayLogs.reduce(
    (acc, l) => {
      const f = l.grams / 100;
      acc.calories += (l.foodItem?.calories ?? 0) * f;
      acc.protein += (l.foodItem?.protein ?? 0) * f;
      acc.carbs += (l.foodItem?.carbs ?? 0) * f;
      acc.fat += (l.foodItem?.fat ?? 0) * f;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const waterLoggedMl = todayLogs
    .filter((l) => /water|ماء|hydrat/i.test(l.foodItem?.name ?? ''))
    .reduce((s, l) => s + Math.max(l.grams ?? 0, 200), 0);

  return {
    date: today,
    targets: {
      calories: targets.calorieTarget,
      protein: targets.proteinTarget,
      carbs: targets.carbTarget,
      fat: targets.fatTarget,
      waterMl: targets.waterMl ?? 2500,
    },
    logged: {
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein * 10) / 10,
      carbs: Math.round(totals.carbs * 10) / 10,
      fat: Math.round(totals.fat * 10) / 10,
      waterMl: Math.round(waterLoggedMl),
      mealCount: todayLogs.length,
    },
    foods: todayLogs.slice(0, 12).map(summarizeFoodLog),
  };
}

function buildNutritionWeek(weekLogs) {
  const recentNames = [...new Set(weekLogs.map((l) => l.foodItem?.name).filter(Boolean))].slice(
    0,
    8
  );
  return {
    recentFoodNames: recentNames,
    logCount: weekLogs.length,
  };
}

function summarizeWorkoutDay(day) {
  if (!day) return null;
  if (day.isRest) {
    return { dayIndex: day.dayIndex, isRest: true, type: day.type ?? 'rest' };
  }
  return {
    dayIndex: day.dayIndex,
    isRest: false,
    type: day.type ?? null,
    exercises: (day.exercises || []).slice(0, 12).map((e) => ({
      name: e.name,
      sets: e.sets,
      reps: e.reps,
      restSec: e.restSec ?? null,
    })),
  };
}

function summarizeDietDay(day) {
  if (!day) return null;
  return {
    dayIndex: day.dayIndex,
    meals: (day.meals || []).slice(0, 8).map((m) => ({
      slot: m.slot,
      name: m.name,
      grams: m.grams,
      calories: m.calories,
      protein: m.protein,
      carbs: m.carbs,
      fat: m.fat,
    })),
  };
}

function summarizeWeekPlan(plan) {
  if (!plan) return null;
  const week = plan.workoutWeeks?.[0];
  return {
    version: plan.version,
    source: plan.source,
    dailyTargets: plan.dailyTargets ?? null,
    coachNotes: plan.coachNotes ?? null,
    workoutDays: (week?.days || []).slice(0, 7).map((d) => ({
      dayIndex: d.dayIndex,
      isRest: Boolean(d.isRest),
      type: d.type ?? null,
      exerciseCount: (d.exercises || []).length,
    })),
    dietDayCount: (plan.dietDays || []).length,
  };
}

async function buildContextBundleFresh(userId) {
  const today = utcDayStart().toISOString().slice(0, 10);
  const { start, end } = dayBounds(today);

  const [
    user,
    profile,
    settings,
    todayLogs,
    weekLogs,
    bodyMetric,
    readinessLog,
    progressSnapshot,
    aiMemories,
    dailyPlan,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    prisma.profile.findUnique({ where: { userId } }),
    getOrCreateUserSettings(userId),
    prisma.foodLog.findMany({
      where: { userId, loggedAt: { gte: start, lt: end } },
      include: {
        foodItem: {
          select: {
            name: true,
            calories: true,
            protein: true,
            carbs: true,
            fat: true,
            fdcId: true,
          },
        },
      },
      orderBy: { loggedAt: 'desc' },
      take: 30,
    }),
    prisma.foodLog.findMany({
      where: {
        userId,
        loggedAt: { gte: new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000), lt: end },
      },
      include: { foodItem: { select: { name: true, fdcId: true } } },
      orderBy: { loggedAt: 'desc' },
      take: 50,
    }),
    prisma.bodyMetric.findFirst({
      where: { userId },
      orderBy: { recordedAt: 'desc' },
    }),
    prisma.readinessLog.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
    }),
    prisma.progressSnapshot.findFirst({
      where: { userId },
      orderBy: { weekStart: 'desc' },
    }),
    prisma.aiMemory.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: { key: true, summary: true, confidence: true, source: true },
    }),
    prisma.dailyAthletePlan.findFirst({
      where: { userId, date: start },
    }),
  ]);

  const settingsRow = asRow(settings) || {};
  const locale = settingsRow.language === 'en' ? 'en' : 'ar';
  const timezone = settingsRow.timezone || 'UTC';
  const profileRow = asRow(profile);
  const onboarding = extractOnboardingNutrition(profileRow?.onboardingData);
  const targets = estimateTargets(profileRow);
  const age = ageFromDateOfBirth(profileRow?.dateOfBirth);
  const bodyMetricRow = asRow(bodyMetric);
  const readinessRow = asRow(readinessLog);
  const progressRow = asRow(progressSnapshot);
  const dailyPlanRow = asRow(dailyPlan);

  let plan = null;
  try {
    plan = await fetchActivePlan(userId);
  } catch {
    plan = null;
  }

  const dietDay = plan ? todayDietDay(plan) : null;
  const workoutDay = plan ? todayWorkoutDay(plan) : null;

  return {
    profile: profileRow
      ? {
          displayName: profileRow.displayName ?? null,
          role: user?.role || 'athlete',
          gender: profileRow.gender ?? null,
          ageYears: age,
          heightCm: profileRow.height ?? null,
          weightKg: profileRow.weight ?? null,
          fitnessGoal: profileRow.fitnessGoal ?? null,
          fitnessLevel: profileRow.fitnessLevel ?? null,
          medicalNotes: profileRow.medicalNotes ?? null,
        }
      : null,
    onboardingSummary: onboarding,
    nutritionToday: buildNutritionToday(today, todayLogs, targets),
    nutritionWeek: buildNutritionWeek(weekLogs),
    workoutToday: summarizeWorkoutDay(workoutDay),
    workoutWeek: summarizeWeekPlan(plan),
    todayPlan: {
      diet: summarizeDietDay(dietDay),
      workout: summarizeWorkoutDay(workoutDay),
      dailyAthletePlan: dailyPlanRow
        ? {
            status: dailyPlanRow.status,
            lifeMode: dailyPlanRow.lifeMode,
            readinessScore: dailyPlanRow.readinessScore ?? null,
            explainabilityText: dailyPlanRow.explainabilityText ?? null,
          }
        : null,
    },
    weekPlanSummary: summarizeWeekPlan(plan),
    bodyMetricsLatest: bodyMetricRow
      ? {
          weightKg: bodyMetricRow.weightKg ?? null,
          bodyFatPct: bodyMetricRow.bodyFatPct ?? null,
          measurements: bodyMetricRow.measurements ?? null,
          recordedAt: bodyMetricRow.recordedAt,
        }
      : null,
    readinessLatest: readinessRow
      ? {
          date: readinessRow.date,
          sleepQuality: readinessRow.sleepQuality ?? null,
          soreness: readinessRow.soreness ?? null,
          rpe: readinessRow.rpe ?? null,
          notes: readinessRow.notes ?? null,
        }
      : null,
    progressSnapshot: progressRow
      ? {
          weekStart: progressRow.weekStart,
          adherencePct: progressRow.adherencePct ?? null,
          workoutAdherence: progressRow.workoutAdherence ?? null,
          nutritionAdherence: progressRow.nutritionAdherence ?? null,
          weightDeltaKg: progressRow.weightDeltaKg ?? null,
          plateauFlag: progressRow.plateauFlag,
          decision: progressRow.decision,
          aiSummary: progressRow.aiSummary ?? null,
        }
      : null,
    aiMemories: (Array.isArray(aiMemories) ? aiMemories : []).map((m) => ({
      key: m.key,
      summary: m.summary,
      confidence: m.confidence,
      source: m.source,
    })),
    behavioralSignals: {
      skippedMuscleGroups: [],
      preferredExercises: [],
      mealSkipPatterns: [],
    },
    constraints: {
      injuries: onboarding.injuries,
      excludedExercises: [],
      excludedFoods: onboarding.diet,
      religiousDiet: onboarding.diet.length ? onboarding.diet.join(', ') : '',
      lifeMode: dailyPlanRow?.lifeMode ? String(dailyPlanRow.lifeMode).toLowerCase() : 'normal',
    },
    gymTrainerOrdersSummary: {},
    locale,
    timezone,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * @param {string} userId
 * @param {{ bypassCache?: boolean }} [opts]
 */
async function buildContextBundle(userId, { bypassCache = false } = {}) {
  if (!bypassCache) {
    const cached = await redisGetJson(cagCacheKey(userId));
    if (cached && typeof cached === 'object' && cached.locale) {
      return cached;
    }
  }

  const bundle = await buildContextBundleFresh(userId);
  await redisSetJson(cagCacheKey(userId), bundle, getCagCacheTtlMs());
  return bundle;
}

async function invalidateContextBundle(userId) {
  return redisDel(cagCacheKey(userId));
}

module.exports = {
  buildContextBundle,
  buildContextBundleFresh,
  invalidateContextBundle,
  cagCacheKey,
  getCagCacheTtlMs,
};
