/**
 * Behavioral + biometric signals for adaptation decisions.
 */
const { prisma } = require('../../db');
const { weekRange, weekDateOnlyBounds } = require('./weekBounds');

const PAIN_KEYWORDS =
  /ألم|الم|وجع|إصاب|injury|hurt|pain|swollen|التواء|تمزق|كسر|ظهر|ركبة|كتف/i;

/**
 * @param {string} userId
 * @param {Date} weekStart
 * @param {{ timezone?: string, adherence?: object }} [opts]
 */
async function collectAdaptationSignals(userId, weekStart, opts = {}) {
  const timezone = opts.timezone || 'UTC';
  const { start, end, startIso, endIso } = weekRange(weekStart);
  const { startDateOnly, endDateOnly } = weekDateOnlyBounds(weekStart, timezone);
  const rangeStart = new Date(start.getTime());
  const rangeEnd = new Date(end.getTime() + 24 * 60 * 60 * 1000);

  const [
    readinessLogs,
    bodyMetrics,
    priorSnapshots,
    planChanges,
    planFeedback,
    profile,
  ] = await Promise.all([
    prisma.readinessLog.findMany({
      where: { userId, date: { gte: startDateOnly, lte: endDateOnly } },
      orderBy: { date: 'asc' },
    }),
    prisma.bodyMetric.findMany({
      where: { userId, recordedAt: { gte: rangeStart, lt: rangeEnd } },
      orderBy: { recordedAt: 'asc' },
    }),
    prisma.progressSnapshot.findMany({
      where: { userId },
      orderBy: { weekStart: 'desc' },
      take: 6,
    }),
    prisma.planChangeLog.findMany({
      where: { userId, createdAt: { gte: rangeStart, lt: rangeEnd } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.planFeedback.findFirst({
      where: { userId, weekStart: startDateOnly },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.profile.findUnique({ where: { userId }, select: { weight: true, fitnessGoal: true } }),
  ]);

  const adherence = opts.adherence || {};
  const missedWorkoutDays = adherence.missedWorkoutDays ?? 0;

  const readinessScores = readinessLogs.map((r) => {
    const sleep = r.sleepQuality ?? 3;
    const soreness = r.soreness ?? 3;
    const rpe = r.rpe ?? 3;
    return Math.round(((sleep + (6 - soreness) + (6 - rpe)) / 3) * 20);
  });
  const avgReadiness =
    readinessScores.length > 0
      ? Math.round(readinessScores.reduce((a, b) => a + b, 0) / readinessScores.length)
      : null;

  const lowReadinessStreak = countConsecutiveLowReadiness(readinessLogs);

  let weightDeltaKg = null;
  if (bodyMetrics.length >= 2) {
    const first = bodyMetrics[0].weightKg;
    const last = bodyMetrics[bodyMetrics.length - 1].weightKg;
    if (first != null && last != null) {
      weightDeltaKg = Math.round((last - first) * 10) / 10;
    }
  } else if (bodyMetrics.length === 1 && profile?.weight != null && bodyMetrics[0].weightKg != null) {
    weightDeltaKg = Math.round((bodyMetrics[0].weightKg - profile.weight) * 10) / 10;
  }

  const weightSpike =
    weightDeltaKg != null && Math.abs(weightDeltaKg) >= Number(process.env.ADAPT_WEIGHT_SPIKE_KG || 1.5);

  const plateauWeeks = countPlateauWeeks(priorSnapshots, startDateOnly);
  const painReports = planChanges.filter(
    (c) => PAIN_KEYWORDS.test(c.reason || '') || c.changeType === 'pain_report'
  );
  const manualEdits = planChanges.filter((c) =>
    ['manual_edit', 'meal_swap', 'exercise_swap', 'skip_day', 'life_mode'].includes(c.changeType)
  );
  const chatSignals = planChanges.filter((c) => c.triggeredBy === 'chat' || c.changeType === 'chat_adapt');

  const negativeFeedback = planFeedback?.rating === 'down' || planFeedback?.rating === 'thumbs_down';

  return {
    weekStart: startIso,
    weekEnd: endIso,
    missedWorkoutDays,
    skippedDays: adherence.skippedDays ?? 0,
    overallAdherence: adherence.overall ?? 0,
    workoutAdherence: adherence.workoutAdherence ?? 0,
    nutritionAdherence: adherence.nutritionAdherence ?? 0,
    readinessCount: readinessLogs.length,
    avgReadiness,
    lowReadinessStreak,
    weightDeltaKg,
    weightSpike,
    plateauWeeks,
    painReports: painReports.length,
    manualEditCount: manualEdits.length,
    chatSignalCount: chatSignals.length,
    negativeFeedback,
    planFeedbackRating: planFeedback?.rating ?? null,
    recentChangeTypes: planChanges.slice(0, 5).map((c) => c.changeType),
  };
}

function countConsecutiveLowReadiness(logs) {
  let streak = 0;
  let max = 0;
  for (const r of logs) {
    const low = (r.soreness ?? 3) >= 4 || (r.rpe ?? 3) >= 4 || (r.sleepQuality ?? 3) <= 2;
    if (low) {
      streak += 1;
      max = Math.max(max, streak);
    } else {
      streak = 0;
    }
  }
  return max;
}

function countPlateauWeeks(snapshots, beforeWeekStart) {
  let count = 0;
  for (const s of snapshots) {
    if (s.weekStart >= beforeWeekStart) continue;
    if (s.plateauFlag || (s.adherencePct != null && s.adherencePct >= 75 && s.adherencePct <= 85)) {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}

function detectPainInText(text) {
  return PAIN_KEYWORDS.test(String(text || ''));
}

module.exports = { collectAdaptationSignals, detectPainInText, PAIN_KEYWORDS };
