/**
 * Orchestrate weekly check-in → snapshot → adaptation apply.
 */
const { prisma } = require('../../db');
const { getOrCreateUserSettings } = require('../userSettings');
const { parseWeekStart, weekDateOnlyBounds } = require('./weekBounds');
const { getWeeklyReviewStatus } = require('./weeklyReview');
const { applyAdaptationDecision } = require('./applyAdaptation');
const { buildProgressSnapshotPayload, persistProgressSnapshot } = require('./progressSnapshot');

/**
 * @param {string} userId
 * @param {{
 *   weekStart?: string,
 *   confirmMacro?: boolean,
 *   skipApply?: boolean,
 *   feedback?: { rating?: string, reason?: string },
 * }} [opts]
 */
async function runWeeklyAdaptation(userId, opts = {}) {
  const settings = await getOrCreateUserSettings(userId);
  const locale = settings?.language === 'en' ? 'en' : 'ar';
  const timezone = settings?.timezone || 'UTC';

  let weekStart = parseWeekStart(opts.weekStart);
  const { startDateOnly } = weekDateOnlyBounds(weekStart, timezone);

  if (opts.feedback?.rating) {
    const activePlan = await prisma.workoutPlan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { weekStart: 'desc' },
      select: { id: true },
    });
    const fbPayload = {
      rating: opts.feedback.rating,
      reason: opts.feedback.reason?.slice(0, 2000) || null,
      planId: activePlan?.id ?? null,
    };
    const existingFb = await prisma.planFeedback.findFirst({
      where: { userId, weekStart: startDateOnly },
      orderBy: { createdAt: 'desc' },
    });
    if (existingFb) {
      await prisma.planFeedback.update({ where: { id: existingFb.id }, data: fbPayload });
    } else {
      await prisma.planFeedback.create({
        data: { userId, weekStart: startDateOnly, ...fbPayload },
      });
    }
  }

  const status = await getWeeklyReviewStatus(userId, {
    weekStart: opts.weekStart,
    locale,
  });

  if (!status.weekEnded) {
    return { ok: false, code: 'WEEK_NOT_ENDED', status };
  }

  if (status.missing?.length > 0) {
    return { ok: false, code: 'MISSING_DATA', missing: status.missing, status };
  }

  if (status.submitted && !opts.confirmMacro) {
    return { ok: true, code: 'ALREADY_SUBMITTED', status };
  }

  weekStart = parseWeekStart(opts.weekStart || status.weekStart);

  let payload = await buildProgressSnapshotPayload(userId, weekStart, { timezone, locale });
  const { adherence, signals, evaluation } = payload;

  const snapshot = await persistProgressSnapshot(userId, weekStart, payload, timezone);

  let applyResult = { applied: false, decision: evaluation.decision };
  if (!opts.skipApply) {
    applyResult = await applyAdaptationDecision(userId, {
      decision: evaluation.decision,
      evaluation,
      signals,
      adherence,
      locale,
      timezone,
      confirmMacro: opts.confirmMacro,
    });
  }

  return {
    ok: true,
    snapshot: {
      id: snapshot.id,
      decision: snapshot.decision,
      adherencePct: snapshot.adherencePct,
      weekStart: status.weekStart,
    },
    evaluation,
    signals,
    adherence,
    apply: applyResult,
    status,
  };
}

module.exports = { runWeeklyAdaptation };
