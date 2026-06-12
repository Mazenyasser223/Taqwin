/**
 * Block D7 — behavioral signals for CAG (skips, swaps, exercise preferences).
 */
const { prisma } = require('../../db');

const SIGNAL_WINDOW_DAYS = 30;
const EXERCISE_PREF_DAYS = 14;

function uniqueStrings(items, limit = 8) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const s = String(item || '').trim();
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

function musclesFromExercise(exercise) {
  if (!exercise) return [];
  const primary = exercise.primaryMuscles;
  if (Array.isArray(primary)) {
    return primary.map((m) => String(m).trim()).filter(Boolean);
  }
  if (primary && typeof primary === 'object') {
    return Object.values(primary)
      .flat()
      .map((m) => String(m).trim())
      .filter(Boolean);
  }
  if (exercise.category) return [String(exercise.category)];
  return [];
}

function mealSlotFromChange(change) {
  const summary = change.afterSummary || change.beforeSummary || {};
  if (summary.slot) return String(summary.slot);
  const reason = String(change.reason || '');
  const slotMatch = reason.match(/\b(breakfast|lunch|dinner|snack|فطار|غدا|عشا|سناك)\b/i);
  return slotMatch ? slotMatch[1] : null;
}

/**
 * @param {string} userId
 * @param {{ since?: Date }} [opts]
 */
async function buildBehavioralSignals(userId, opts = {}) {
  const since =
    opts.since || new Date(Date.now() - SIGNAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const exerciseSince = new Date(Date.now() - EXERCISE_PREF_DAYS * 24 * 60 * 60 * 1000);

  const [planChanges, exerciseLogs, skippedDailyPlans] = await Promise.all([
    prisma.planChangeLog.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: {
        changeType: true,
        reason: true,
        beforeSummary: true,
        afterSummary: true,
        triggeredBy: true,
      },
    }),
    prisma.exerciseLog.findMany({
      where: { userId, loggedAt: { gte: exerciseSince } },
      include: {
        exercise: {
          select: { name: true, nameAr: true, category: true, primaryMuscles: true },
        },
      },
      orderBy: { loggedAt: 'desc' },
      take: 120,
    }),
    prisma.dailyAthletePlan.findMany({
      where: {
        userId,
        status: 'skipped',
        date: { gte: since },
      },
      orderBy: { date: 'desc' },
      take: 14,
      select: { date: true, workoutPlanDayId: true },
    }),
  ]);

  const skippedMuscleGroups = [];
  const mealSkipPatterns = [];

  for (const change of planChanges) {
    if (change.changeType === 'skip_day') {
      mealSkipPatterns.push('skipped_workout_day');
    }
    if (change.changeType === 'meal_swap') {
      const slot = mealSlotFromChange(change);
      mealSkipPatterns.push(slot ? `meal_swap:${slot}` : 'meal_swap');
    }
    if (change.changeType === 'exercise_swap') {
      const before = change.beforeSummary || {};
      if (before.exerciseName) {
        skippedMuscleGroups.push(`swapped_from:${before.exerciseName}`);
      }
    }
    if (change.changeType === 'chat_adapt' && /meal|وجبة|فطار|غدا|عشا/i.test(change.reason || '')) {
      mealSkipPatterns.push('chat_meal_adapt');
    }
  }

  const workoutDayIds = skippedDailyPlans
    .map((d) => d.workoutPlanDayId)
    .filter(Boolean);
  if (workoutDayIds.length) {
    const planExercises = await prisma.workoutPlanExercise.findMany({
      where: { dayId: { in: workoutDayIds } },
      include: {
        exercise: { select: { primaryMuscles: true, category: true, name: true } },
      },
      take: 40,
    });
    for (const row of planExercises) {
      skippedMuscleGroups.push(...musclesFromExercise(row.exercise));
    }
  }

  const exerciseCounts = new Map();
  for (const log of exerciseLogs) {
    const name = log.exercise?.nameAr || log.exercise?.name;
    if (!name) continue;
    exerciseCounts.set(name, (exerciseCounts.get(name) || 0) + 1);
  }
  const preferredExercises = [...exerciseCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => `${name} (${count}x)`);

  return {
    skippedMuscleGroups: uniqueStrings(skippedMuscleGroups, 8),
    preferredExercises: uniqueStrings(preferredExercises, 6),
    mealSkipPatterns: uniqueStrings(mealSkipPatterns, 8),
    recentChangeTypes: uniqueStrings(
      planChanges.slice(0, 8).map((c) => c.changeType),
      8
    ),
    chatAdaptCount: planChanges.filter(
      (c) => c.triggeredBy === 'chat' || c.changeType === 'chat_adapt'
    ).length,
  };
}

module.exports = { buildBehavioralSignals };
