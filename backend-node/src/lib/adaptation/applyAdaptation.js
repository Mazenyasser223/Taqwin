/**
 * Apply adaptation decisions to Postgres daily plans / plan generation.
 */
const { prisma } = require('../../db');
const { logger } = require('../logger');
const { buildContextBundle, formatContextBundleForPlan } = require('../contextBundle');
const { isFastApiBridgeEnabled, planAdaptViaFastApi } = require('../../services/aiFastApiClient');
const { validatePlanForPersist } = require('../plans/planValidation');
const { persistPlanToPostgres } = require('../plans/persistPostgres');
const { syncDailyPlansAfterWeeklyPlan } = require('../plans/dailyAthletePlanService');
const { generatePlanForUser } = require('../plans/generator');
const { enqueuePlanGenerate, isPlanQueueEnabled } = require('../../jobs/planGenerateJobs');
const { weekStartSundayUtc } = require('../plans/planWeek');
const { calendarDateOnly, addCalendarDays } = require('../plans/planCalendar');
const { recordPlanChange } = require('./planChangeLog');
const { emitAdaptationNotification } = require('./notifyAdaptation');

/**
 * @param {string} userId
 * @param {{
 *   decision: string,
 *   evaluation: object,
 *   signals: object,
 *   adherence: object,
 *   locale?: 'ar'|'en',
 *   timezone?: string,
 *   confirmMacro?: boolean,
 * }} ctx
 */
async function applyAdaptationDecision(userId, ctx) {
  const locale = ctx.locale === 'en' ? 'en' : 'ar';
  const decision = ctx.decision || 'keep';
  const explain = ctx.evaluation?.explainabilityText || '';

  if (decision === 'macro' && !ctx.confirmMacro) {
    await emitAdaptationNotification({
      userId,
      kind: 'macro_pending',
      locale,
      decision,
      reason: explain,
    });
    return {
      applied: false,
      pendingConfirmation: true,
      decision,
      explainabilityText: explain,
    };
  }

  if (decision === 'macro' && ctx.confirmMacro) {
    const regen = await runMacroRegeneration(userId, { locale, reason: explain });
    await recordPlanChange({
      userId,
      changeType: 'macro_regen',
      reason: explain,
      triggeredBy: 'weekly_review',
      locale,
      notify: true,
    });
    return {
      applied: true,
      decision: 'macro',
      mode: regen.mode,
      explainabilityText: explain,
      plan: regen.plan,
    };
  }

  if (decision === 'meso') {
    const meso = await applyMesoReschedule(userId, {
      locale,
      timezone: ctx.timezone,
      signals: ctx.signals,
      explain,
    });
    await recordPlanChange({
      userId,
      changeType: 'meso_reschedule',
      reason: explain,
      triggeredBy: 'weekly_review',
      locale,
      notify: true,
    });
    return { applied: true, decision: 'meso', ...meso };
  }

  if (decision === 'micro') {
    const micro = await applyMicroPatch(userId, {
      locale,
      timezone: ctx.timezone,
      signals: ctx.signals,
      explain,
    });
    await recordPlanChange({
      userId,
      changeType: 'micro_patch',
      reason: explain,
      triggeredBy: 'weekly_review',
      locale,
      notify: true,
    });
    return { applied: true, decision: 'micro', ...micro };
  }

  await emitAdaptationNotification({
    userId,
    kind: 'adaptation_applied',
    locale,
    decision: 'keep',
    reason: explain,
  });

  return { applied: true, decision: 'keep', explainabilityText: explain };
}

async function runMacroRegeneration(userId, { locale, reason }) {
  if (isPlanQueueEnabled()) {
    const enq = await enqueuePlanGenerate({
      userId,
      locale,
      regenerationReason: 'adaptation_macro',
      source: 'adaptation',
    });
    if (enq.ok) {
      return { mode: 'queued', jobId: enq.jobId };
    }
  }

  const result = await generatePlanForUser({
    userId,
    locale,
    regenerationReason: `adaptation_macro: ${reason}`.slice(0, 200),
    planSource: 'adaptation',
  });
  return { mode: 'inline', plan: result.plan };
}

/**
 * Meso: simplify upcoming week — mark heavy days skipped + travel life mode on missed pattern.
 */
async function applyMesoReschedule(userId, { locale, timezone, signals, explain }) {
  const start = calendarDateOnly(new Date(), timezone);
  const missed = Math.max(0, signals.missedWorkoutDays ?? 0);
  const lifeMode = missed >= 3 ? 'travel' : 'normal';

  const patches = [];
  for (let i = 0; i < 7; i += 1) {
    const dateOnly = addCalendarDays(start, i);
    if (i < Math.min(missed, 2)) {
      const row = await prisma.dailyAthletePlan.updateMany({
        where: { userId, date: dateOnly },
        data: {
          status: 'adapted',
          lifeMode,
          adaptedFromProgress: true,
          explainabilityText: explain,
          aiNotes:
            locale === 'ar'
              ? 'إعادة جدولة أسبوعية — تخفيف بعد أيام فائتة.'
              : 'Weekly reschedule — lighter load after missed days.',
        },
      });
      if (row.count) patches.push(dateOnly.toISOString().slice(0, 10));
    }
  }

  await tryFastApiMesoPlan(userId, { locale, decisionHint: 'meso', explain });

  await emitAdaptationNotification({
    userId,
    kind: 'adaptation_applied',
    locale,
    decision: 'meso',
    reason: explain,
  });

  return { patchedDates: patches, lifeMode };
}

async function applyMicroPatch(userId, { locale, timezone, signals, explain }) {
  const dateOnly = calendarDateOnly(new Date(), timezone);
  const lifeMode = signals.painReports > 0 ? 'injury_flare' : 'normal';

  await prisma.dailyAthletePlan.upsert({
    where: { userId_date: { userId, date: dateOnly } },
    create: {
      userId,
      date: dateOnly,
      status: 'adapted',
      lifeMode,
      adaptedFromProgress: true,
      explainabilityText: explain,
      aiNotes:
        locale === 'ar'
          ? 'تعديل يومي — جاهزية/ألم أو طلب من المحادثة.'
          : 'Daily tweak — readiness/pain or chat request.',
    },
    update: {
      status: 'adapted',
      lifeMode,
      adaptedFromProgress: true,
      explainabilityText: explain,
    },
  });

  await tryFastApiMesoPlan(userId, { locale, decisionHint: 'micro', explain });

  await emitAdaptationNotification({
    userId,
    kind: 'adaptation_applied',
    locale,
    decision: 'micro',
    reason: explain,
  });

  return { date: dateOnly.toISOString().slice(0, 10), lifeMode };
}

async function tryFastApiMesoPlan(userId, { locale, decisionHint, explain }) {
  if (!isFastApiBridgeEnabled()) return null;
  try {
    const bundle = await buildContextBundle(userId);
    const formatted = formatContextBundleForPlan(bundle);
    const adapt = await planAdaptViaFastApi({
      userId,
      contextBundle: formatted,
      snapshot: {
        decisionHint,
        explain,
        overallAdherence: bundle?.progress?.adherencePct,
        missedWorkoutDays: bundle?.behavioral?.missedWorkoutDays,
      },
      decisionHint,
    });
    if (!adapt?.plan) return adapt;

    const profile = await prisma.profile.findUnique({ where: { userId } });
    const validated = await validatePlanForPersist(adapt.plan, { profile, locale });
    if (!validated.ok) {
      logger.warn({ userId, decisionHint, errors: validated.errors }, 'adapt plan validation failed');
      return null;
    }

    await persistPlanToPostgres({
      userId,
      planData: validated.plan,
      explainabilityText: adapt.explainabilityText || explain,
      prismaSource: 'adaptation',
      weekStart: weekStartSundayUtc(),
      locale,
      regenerationReason: `adapt:${decisionHint}`,
    });
    await syncDailyPlansAfterWeeklyPlan(userId);
    return adapt;
  } catch (err) {
    logger.warn({ err: err.message, userId, decisionHint }, 'FastAPI plan/adapt skipped');
    return null;
  }
}

module.exports = { applyAdaptationDecision, applyMicroPatch, applyMesoReschedule };
