/**
 * Weekly review status — required data before AI adaptation runs.
 */
const { prisma } = require('../../db');
const { getOrCreateUserSettings } = require('../userSettings');
const {
  completedReviewWeekStart,
  weekRange,
  isWeekEndedForReview,
  weekDateOnlyBounds,
  parseWeekStart,
} = require('./weekBounds');
const { computeWeeklyAdherence } = require('./adherence');
const { collectAdaptationSignals } = require('./signals');
const { evaluateAdaptation } = require('./adaptationEngine');

const REQUIRED_READINESS_DAYS = Math.max(
  1,
  Math.min(7, Number(process.env.ADAPT_READINESS_MIN_DAYS || 3))
);

/**
 * @param {string} userId
 * @param {{ weekStart?: string, locale?: 'ar'|'en' }} [opts]
 */
async function getWeeklyReviewStatus(userId, opts = {}) {
  const settings = await getOrCreateUserSettings(userId);
  const locale = opts.locale || (settings?.language === 'en' ? 'en' : 'ar');
  const timezone = settings?.timezone || 'UTC';

  const reviewWeekStart = opts.weekStart
    ? parseWeekStart(opts.weekStart)
    : completedReviewWeekStart();
  const { startIso, endIso } = weekRange(reviewWeekStart);
  const { startDateOnly, endDateOnly } = weekDateOnlyBounds(reviewWeekStart, timezone);
  const weekEnded = isWeekEndedForReview(reviewWeekStart);

  const [snapshot, readinessCount, weightInWeek, feedback, pendingMacro] = await Promise.all([
    prisma.progressSnapshot.findUnique({
      where: { userId_weekStart: { userId, weekStart: startDateOnly } },
    }),
    prisma.readinessLog.count({
      where: { userId, date: { gte: startDateOnly, lte: endDateOnly } },
    }),
    prisma.bodyMetric.findFirst({
      where: {
        userId,
        recordedAt: {
          gte: new Date(reviewWeekStart.getTime()),
          lt: new Date(reviewWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { recordedAt: 'desc' },
    }),
    prisma.planFeedback.findFirst({
      where: { userId, weekStart: startDateOnly },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.progressSnapshot.findFirst({
      where: { userId, decision: 'macro' },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const missing = [];
  if (!weightInWeek?.weightKg) missing.push('weight');
  if (readinessCount < REQUIRED_READINESS_DAYS) missing.push('readiness');
  if (!feedback) missing.push('feedback');

  const due = weekEnded && !snapshot;
  const canSubmit = weekEnded && missing.length === 0;
  const macroPendingConfirm =
    pendingMacro?.decision === 'macro' &&
    pendingMacro.weekStart.getTime() === startDateOnly.getTime() &&
    !snapshot?.aiSummary?.includes('macro_confirmed');

  const adherence = await computeWeeklyAdherence(userId, reviewWeekStart, { timezone });
  const signals = await collectAdaptationSignals(userId, reviewWeekStart, {
    timezone,
    adherence,
  });
  const preview = evaluateAdaptation(signals, { locale });

  return {
    due,
    canSubmit,
    weekEnded,
    weekStart: startIso,
    weekEnd: endIso,
    missing,
    requiredReadinessDays: REQUIRED_READINESS_DAYS,
    readinessDaysLogged: readinessCount,
    hasWeight: Boolean(weightInWeek?.weightKg),
    hasFeedback: Boolean(feedback),
    submitted: Boolean(snapshot),
    lastSnapshot: snapshot
      ? {
          decision: snapshot.decision,
          adherencePct: snapshot.adherencePct,
          aiSummary: snapshot.aiSummary,
          createdAt: snapshot.createdAt.toISOString(),
        }
      : null,
    macroPendingConfirm,
    preview: {
      decision: preview.decision,
      requiresConfirmation: preview.requiresConfirmation,
      reasons: preview.reasons,
      reasonCodes: preview.reasonCodes,
    },
    adherence,
    signals: {
      missedWorkoutDays: signals.missedWorkoutDays,
      weightDeltaKg: signals.weightDeltaKg,
      avgReadiness: signals.avgReadiness,
    },
  };
}

module.exports = {
  getWeeklyReviewStatus,
  REQUIRED_READINESS_DAYS,
};
