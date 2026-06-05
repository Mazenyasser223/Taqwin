/**
 * Block C10 — ProgressSnapshot persistence from weekly metrics.
 */
const { prisma } = require('../../db');
const { parseWeekStart, weekDateOnlyBounds } = require('./weekBounds');
const { computeWeeklyAdherence } = require('./adherence');
const { collectAdaptationSignals } = require('./signals');
const { evaluateAdaptation } = require('./adaptationEngine');

/**
 * Build snapshot payload from logs (no user check-in required).
 * @param {string} userId
 * @param {Date} weekStart
 * @param {{ timezone?: string, locale?: 'ar'|'en' }} [opts]
 */
async function buildProgressSnapshotPayload(userId, weekStart, opts = {}) {
  const locale = opts.locale === 'en' ? 'en' : 'ar';
  const timezone = opts.timezone || 'UTC';

  const adherence = await computeWeeklyAdherence(userId, weekStart, { timezone });
  const signals = await collectAdaptationSignals(userId, weekStart, { timezone, adherence });
  const evaluation = evaluateAdaptation(signals, { locale });

  return {
    adherence,
    signals,
    evaluation,
    metricsOnly: false,
  };
}

/**
 * Upsert ProgressSnapshot row (metrics + optional decision).
 * @param {string} userId
 * @param {Date} weekStart
 * @param {{
 *   adherence: object,
 *   signals: object,
 *   evaluation?: object,
 *   pendingReview?: boolean,
 * }} data
 * @param {string} [timezone]
 */
async function persistProgressSnapshot(userId, weekStart, data, timezone = 'UTC') {
  const { startDateOnly } = weekDateOnlyBounds(weekStart, timezone);
  const adherence = data.adherence;
  const signals = data.signals;
  const evaluation = data.evaluation;
  const pending = Boolean(data.pendingReview);

  const decision = pending ? 'keep' : evaluation?.decision || 'keep';
  const aiSummary = pending
    ? 'مراجعة أسبوعية معلّقة — أكمل الوزن والجاهزية والتقييم.'
    : evaluation?.explainabilityText || null;

  return prisma.progressSnapshot.upsert({
    where: { userId_weekStart: { userId, weekStart: startDateOnly } },
    create: {
      userId,
      weekStart: startDateOnly,
      adherencePct: adherence.overall,
      workoutAdherence: adherence.workoutAdherence,
      nutritionAdherence: adherence.nutritionAdherence,
      weightDeltaKg: signals.weightDeltaKg,
      plateauFlag: evaluation?.plateauFlag ?? false,
      aiSummary,
      decision,
    },
    update: {
      adherencePct: adherence.overall,
      workoutAdherence: adherence.workoutAdherence,
      nutritionAdherence: adherence.nutritionAdherence,
      weightDeltaKg: signals.weightDeltaKg,
      plateauFlag: evaluation?.plateauFlag ?? false,
      aiSummary,
      ...(pending ? {} : { decision }),
    },
  });
}

/**
 * C10 cron — record adherence metrics even before athlete submits review.
 * @param {string} userId
 * @param {{ weekStart?: string, timezone?: string, locale?: 'ar'|'en' }} [opts]
 */
async function ensureWeeklyMetricsSnapshot(userId, opts = {}) {
  const weekStart = parseWeekStart(opts.weekStart);
  const payload = await buildProgressSnapshotPayload(userId, weekStart, {
    timezone: opts.timezone,
    locale: opts.locale,
  });
  const row = await persistProgressSnapshot(userId, weekStart, {
    ...payload,
    pendingReview: true,
    locale: opts.locale,
  }, opts.timezone);
  return { snapshot: row, adherence: payload.adherence, previewDecision: payload.evaluation.decision };
}

module.exports = {
  buildProgressSnapshotPayload,
  persistProgressSnapshot,
  ensureWeeklyMetricsSnapshot,
};
