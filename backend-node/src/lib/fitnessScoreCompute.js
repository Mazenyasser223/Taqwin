/**
 * Load raw metrics for a user/day and compute fitness score inputs.
 */
const { randomUUID } = require('crypto');
const { prisma } = require('../db');
const { computeFitnessScoreFromInputs } = require('./fitnessScore');
const {
  buildNutritionDay,
  buildWorkoutDay,
  resolveAthleteTimezone,
  loggedAtRangeFromDateKeys,
} = require('./athleteMetrics');
const { computeWorkoutSetCompletionPct } = require('./exerciseLogNotes');

function sumWaterMlFromFoodLogs(foodLogs) {
  return foodLogs
    .filter((l) => /water|ماء|hydrat/i.test(l.foodItem?.name ?? ''))
    .reduce((s, l) => s + Math.max(l.grams ?? 0, 200), 0);
}

async function sumHydrationLogsMl(userId, dateKey) {
  const { start, end } = loggedAtRangeFromDateKeys(dateKey, dateKey);
  const rows = await prisma.hydrationLog.findMany({
    where: { userId, loggedAt: { gte: start, lt: end } },
    select: { ml: true },
  });
  return rows.reduce((s, r) => s + (r.ml || 0), 0);
}

async function loadFitnessScoreInputs(userId, dateKey, opts = {}) {
  const timezone = opts.timezone || (await resolveAthleteTimezone(userId));
  const profile =
    opts.profile ||
    (await prisma.athleteProfile.findUnique({
      where: { userId },
      select: { onboardingData: true, fitnessGoal: true },
    }));

  const nutrition = await buildNutritionDay(userId, dateKey, timezone, {
    profile,
    foodLogs: opts.foodLogs,
  });
  const workoutDay = await buildWorkoutDay(userId, dateKey, timezone, {
    workoutLogs: opts.workoutLogs,
    exerciseLogs: opts.exerciseLogs,
  });

  const { start, end } = loggedAtRangeFromDateKeys(dateKey, dateKey);
  const foodLogsForWater =
    opts.foodLogs ||
    (await prisma.foodLog.findMany({
      where: { userId, loggedAt: { gte: start, lt: end } },
      include: { foodItem: { select: { name: true } } },
    }));

  const waterFromFood = sumWaterMlFromFoodLogs(foodLogsForWater);
  const waterFromHydration = await sumHydrationLogsMl(userId, dateKey);
  const waterCurrentMl = waterFromFood + waterFromHydration;

  let workoutProgress = 0;
  if (workoutDay.sessionCount > 0) {
    if (opts.workoutCompletionPct != null) {
      workoutProgress = Math.min(1, Math.max(0, opts.workoutCompletionPct / 100));
    } else if (opts.plannedExercises?.length) {
      const exerciseLogs =
        opts.exerciseLogs ||
        (await prisma.exerciseLog.findMany({
          where: { userId, loggedAt: { gte: start, lt: end } },
        }));
      const pct = computeWorkoutSetCompletionPct(exerciseLogs, opts.plannedExercises);
      workoutProgress = pct != null ? Math.min(1, Math.max(0, pct / 100)) : 1;
    } else {
      workoutProgress = 1;
    }
  }

  const sleepPreference = profile?.onboardingData?.sleep ?? null;

  return {
    dateKey,
    timezone,
    sleepPreference,
    caloriesEaten: nutrition.calories ?? 0,
    calorieTarget: nutrition.targets?.calorieTarget ?? 0,
    waterCurrentMl,
    waterTargetMl: nutrition.targets?.waterMl ?? 2500,
    workoutProgress,
    logCount: nutrition.logCount ?? 0,
    workoutSessions: workoutDay.sessionCount ?? 0,
  };
}

async function computeDailyFitnessScore(userId, dateKey, opts = {}) {
  const inputs = await loadFitnessScoreInputs(userId, dateKey, opts);
  const result = computeFitnessScoreFromInputs({
    sleepPreference: inputs.sleepPreference,
    caloriesEaten: inputs.caloriesEaten,
    calorieTarget: inputs.calorieTarget,
    waterCurrentMl: inputs.waterCurrentMl,
    waterTargetMl: inputs.waterTargetMl,
    workoutProgress: inputs.workoutProgress,
  });
  return { ...result, inputs };
}

async function upsertAthleteDailyScore(userId, dateKey, payload, source = 'cron') {
  const data = {
    score: payload.score,
    sleepPts: payload.sleepPts,
    mealsPts: payload.mealsPts,
    waterPts: payload.waterPts,
    workoutPts: payload.workoutPts,
    computedAt: new Date(),
    source,
  };

  const existing = await prisma.athleteDailyScore.findUnique({
    where: { userId_dateKey: { userId, dateKey } },
    select: { id: true },
  });

  if (existing) {
    return prisma.athleteDailyScore.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.athleteDailyScore.create({
    data: {
      id: randomUUID(),
      userId,
      dateKey,
      ...data,
    },
  });
}

async function computeAndPersistDailyScore(userId, dateKey, opts = {}) {
  const computed = await computeDailyFitnessScore(userId, dateKey, opts);
  const row = await upsertAthleteDailyScore(userId, dateKey, computed, opts.source || 'cron');
  return { ...computed, row };
}

module.exports = {
  loadFitnessScoreInputs,
  computeDailyFitnessScore,
  upsertAthleteDailyScore,
  computeAndPersistDailyScore,
  sumWaterMlFromFoodLogs,
};
