/**
 * Fitness notification integration hooks — wire emitters to athlete activity.
 */
const { prisma } = require('../../db');
const { logger } = require('../logger');
const { computeStreak, resolveAthleteTimezone, buildReadinessToday } = require('../athleteMetrics');
const { parseExerciseLogNotes } = require('../exerciseLogNotes');
const { addCalendarDays } = require('../plans/planCalendar');
const { weekStartSundayUtc } = require('../plans/planWeek');
const {
  emitStreakMilestone,
  emitPersonalRecord,
  emitCoachFeedbackAvailable,
  emitWeeklySummary,
  emitRecoveryChanged,
} = require('./fitnessNotify');

const STREAK_MILESTONES = [7, 30, 100];
const RECOVERY_DELTA_THRESHOLD = 8;
const ACTIVE_LOG_DAYS = 120;

function maxKgFromNotes(notes) {
  const parsed = parseExerciseLogNotes(notes);
  if (!parsed.setDetails?.length) return null;
  let max = 0;
  for (const s of parsed.setDetails) {
    if (s.completed && s.kg != null && s.kg > max) max = s.kg;
  }
  return max > 0 ? max : null;
}

function bestSetLabel(notes) {
  const parsed = parseExerciseLogNotes(notes);
  if (!parsed.setDetails?.length) {
    return `${parsed.sets}x${parsed.reps}`;
  }
  let best = null;
  for (const s of parsed.setDetails) {
    if (!s.completed || s.kg == null || s.reps == null) continue;
    const vol = s.kg * s.reps;
    if (!best || vol > best.vol) best = { kg: s.kg, reps: s.reps, vol };
  }
  if (best) return `${best.kg}kg × ${best.reps}`;
  return `${parsed.sets}×${parsed.reps}`;
}

async function loadRecentActivityLogs(userId, timezone) {
  const since = new Date();
  since.setDate(since.getDate() - ACTIVE_LOG_DAYS);
  const [workoutLogs, exerciseLogs] = await Promise.all([
    prisma.workoutLog.findMany({
      where: { userId, loggedAt: { gte: since } },
      select: { loggedAt: true },
    }),
    prisma.exerciseLog.findMany({
      where: { userId, loggedAt: { gte: since } },
      select: { loggedAt: true },
    }),
  ]);
  return { workoutLogs, exerciseLogs, timezone };
}

/**
 * After workout or exercise log — check streak milestones (7 / 30 / 100).
 */
async function afterWorkoutActivityLogged(userId) {
  try {
    const timezone = await resolveAthleteTimezone(userId);
    const { workoutLogs, exerciseLogs } = await loadRecentActivityLogs(userId, timezone);
    const streak = computeStreak(workoutLogs, exerciseLogs, timezone);

    if (!STREAK_MILESTONES.includes(streak)) return null;

    return emitStreakMilestone(userId, streak);
  } catch (err) {
    logger.warn({ err: err?.message, userId }, 'fitness streak notification hook failed');
    return null;
  }
}

/**
 * After exercise log — detect personal record by max weight (kg) on exercise.
 */
async function afterExerciseLogCreated(userId, exercise, notes) {
  try {
    if (!exercise?.id) return null;
    const newMax = maxKgFromNotes(notes);
    if (newMax == null) {
      void afterWorkoutActivityLogged(userId);
      return null;
    }

    const prior = await prisma.exerciseLog.findMany({
      where: { userId, exerciseId: exercise.id },
      orderBy: { loggedAt: 'desc' },
      take: 50,
      select: { id: true, notes: true },
    });

    let previousBest = 0;
    for (const row of prior.slice(1)) {
      const kg = maxKgFromNotes(row.notes);
      if (kg != null && kg > previousBest) previousBest = kg;
    }

    void afterWorkoutActivityLogged(userId);

    if (newMax <= previousBest) return null;

    const name = exercise.nameEn || exercise.name || exercise.nameAr || 'Exercise';
    return emitPersonalRecord(userId, name, bestSetLabel(notes));
  } catch (err) {
    logger.warn({ err: err?.message, userId }, 'fitness PR notification hook failed');
    return null;
  }
}

/**
 * Coach / AI feedback text available after weekly adaptation.
 */
async function afterCoachFeedbackAvailable(userId, message, opts = {}) {
  try {
    const text = String(message || '').trim();
    if (!text) return null;
    return emitCoachFeedbackAvailable(userId, text.slice(0, 500), opts);
  } catch (err) {
    logger.warn({ err: err?.message, userId }, 'coach feedback notification hook failed');
    return null;
  }
}

/**
 * Weekly progress summary after adaptation completes.
 */
async function afterWeeklyAdaptationComplete(userId, { adherence, evaluation, weekStart } = {}) {
  try {
    if (!adherence) return null;

    const workoutPct = Math.round((adherence.workoutAdherence ?? 0) * 100);
    const nutritionPct = Math.round((adherence.nutritionAdherence ?? 0) * 100);
    const decision = evaluation?.decision || 'keep';
    const summary = `Workout ${workoutPct}% · Nutrition ${nutritionPct}% · Plan decision: ${decision}`;

    const weekKey = weekStart || weekStartSundayUtc(new Date()).toISOString().slice(0, 10);

    void afterCoachFeedbackAvailable(userId, evaluation?.explainabilityText, {
      weekKey,
      link: '/dashboard?weeklyReview=1',
    });

    return emitWeeklySummary(userId, summary, weekKey);
  } catch (err) {
    logger.warn({ err: err?.message, userId }, 'weekly summary notification hook failed');
    return null;
  }
}

/**
 * After readiness log — notify on meaningful recovery score shift.
 */
async function afterReadinessRecorded(userId, dateKey) {
  try {
    const today = await buildReadinessToday(userId, dateKey);
    if (!today || today.source !== 'logged') return null;

    const prevDate = addCalendarDays(new Date(`${dateKey}T12:00:00.000Z`), -1)
      .toISOString()
      .slice(0, 10);
    const prev = await buildReadinessToday(userId, prevDate);
    if (!prev) return null;

    if (Math.abs(today.score - prev.score) < RECOVERY_DELTA_THRESHOLD) return null;

    return emitRecoveryChanged(userId, today.score, {
      previousScore: prev.score,
      delta: today.score - prev.score,
    });
  } catch (err) {
    logger.warn({ err: err?.message, userId }, 'recovery notification hook failed');
    return null;
  }
}

module.exports = {
  afterWorkoutActivityLogged,
  afterExerciseLogCreated,
  afterCoachFeedbackAvailable,
  afterWeeklyAdaptationComplete,
  afterReadinessRecorded,
  STREAK_MILESTONES,
  RECOVERY_DELTA_THRESHOLD,
};
