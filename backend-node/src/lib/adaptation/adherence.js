/**
 * Weekly adherence metrics for adaptation (Block C9 / D6).
 */
const { prisma } = require('../../db');
const { estimateDailyTargets } = require('../plans/targets');
const { loadActivePlanDays } = require('../plans/dailyAthletePlanService');
const { weekDateOnlyBounds } = require('./weekBounds');
const { computeWeekWorkoutCompletionPct } = require('../exerciseLogNotes');

/**
 * @param {string} userId
 * @param {Date} weekStart Sunday UTC
 * @param {{ timezone?: string }} [opts]
 */
async function computeWeeklyAdherence(userId, weekStart, opts = {}) {
  const timezone = opts.timezone || 'UTC';
  const { startDateOnly, endDateOnly } = weekDateOnlyBounds(weekStart, timezone);
  const rangeStart = new Date(startDateOnly.getTime());
  const rangeEnd = new Date(endDateOnly.getTime() + 24 * 60 * 60 * 1000);

  const [profile, workoutLogs, foodLogs, exerciseLogs, dailyPlans, planCtx] = await Promise.all([
    prisma.athleteProfile.findUnique({ where: { userId } }),
    prisma.workoutLog.findMany({
      where: { userId, loggedAt: { gte: rangeStart, lt: rangeEnd } },
      select: { loggedAt: true },
    }),
    prisma.foodLog.findMany({
      where: { userId, loggedAt: { gte: rangeStart, lt: rangeEnd } },
      include: {
        foodItem: { select: { calories: true, protein: true, carbs: true, fat: true } },
      },
    }),
    prisma.exerciseLog.findMany({
      where: { userId, loggedAt: { gte: rangeStart, lt: rangeEnd } },
      select: { loggedAt: true, notes: true },
    }),
    prisma.dailyAthletePlan.findMany({
      where: {
        userId,
        date: { gte: startDateOnly, lte: endDateOnly },
      },
      select: { date: true, status: true, workoutPlanDayId: true },
    }),
    loadActivePlanDays(userId),
  ]);

  const targets = estimateDailyTargets(profile);
  const plannedTrainingDays =
    planCtx.workoutPlan?.days?.filter((d) => !d.isRest).length || 4;

  const trainingDayKeys = new Set();
  for (const row of dailyPlans) {
    if (row.workoutPlanDayId && row.status !== 'skipped') {
      trainingDayKeys.add(row.date.toISOString().slice(0, 10));
    }
  }
  if (trainingDayKeys.size === 0 && planCtx.workoutPlan?.days) {
    for (const d of planCtx.workoutPlan.days) {
      if (!d.isRest) trainingDayKeys.add(String(d.dayIndex));
    }
  }

  const daysWithWorkout = new Set();
  for (const w of workoutLogs) {
    daysWithWorkout.add(w.loggedAt.toISOString().slice(0, 10));
  }
  for (const e of exerciseLogs) {
    daysWithWorkout.add(e.loggedAt.toISOString().slice(0, 10));
  }

  const skippedDays = dailyPlans.filter((d) => d.status === 'skipped').length;
  const missedWorkoutDays = Math.max(0, plannedTrainingDays - daysWithWorkout.size - skippedDays);

  const plannedExercises =
    planCtx.workoutPlan?.days?.find((d) => !d.isRest)?.exercises?.map((ex) => ({
      name: ex.exercise?.name || 'Exercise',
      sets: ex.sets ?? 3,
      reps: ex.reps ?? 10,
    })) || [];

  const workoutAdherence = computeWeekWorkoutCompletionPct(
    exerciseLogs,
    plannedExercises,
    plannedTrainingDays
  );

  const byDay = new Map();
  for (const log of foodLogs) {
    const key = log.loggedAt.toISOString().slice(0, 10);
    const row = byDay.get(key) || { calories: 0, protein: 0 };
    const grams = log.grams ?? 100;
    const scale = grams / 100;
    const fi = log.foodItem;
    row.calories += (fi?.calories ?? log.calories ?? 0) * scale;
    row.protein += (fi?.protein ?? log.protein ?? 0) * scale;
    byDay.set(key, row);
  }

  let nutritionDays = 0;
  let nutritionSum = 0;
  for (const [, totals] of byDay) {
    nutritionDays += 1;
    const calPct =
      targets.calorieTarget > 0
        ? Math.min(150, Math.round((totals.calories / targets.calorieTarget) * 100))
        : 0;
    const proPct =
      targets.proteinTarget > 0
        ? Math.min(150, Math.round((totals.protein / targets.proteinTarget) * 100))
        : 0;
    nutritionSum += Math.round((calPct + proPct) / 2);
  }
  const nutritionAdherence =
    nutritionDays > 0 ? Math.round(nutritionSum / nutritionDays) : 0;

  const overall = Math.round(workoutAdherence * 0.55 + nutritionAdherence * 0.45);

  return {
    overall: Math.min(100, Math.max(0, overall)),
    workoutAdherence: Math.min(100, Math.max(0, workoutAdherence)),
    nutritionAdherence: Math.min(100, Math.max(0, nutritionAdherence)),
    plannedTrainingDays,
    completedWorkoutDays: daysWithWorkout.size,
    missedWorkoutDays,
    skippedDays,
    nutritionLoggedDays: nutritionDays,
    targets,
  };
}

module.exports = { computeWeeklyAdherence };
