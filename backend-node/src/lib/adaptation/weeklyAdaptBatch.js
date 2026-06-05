/**
 * Block C10 — batch enqueue weekly adaptation jobs for all due athletes.
 */
const { prisma } = require('../../db');
const { logger } = require('../logger');
const { getWeeklyReviewStatus } = require('./weeklyReview');
const { completedReviewWeekStart, weekRange } = require('./weekBounds');
const { ensureWeeklyMetricsSnapshot } = require('./progressSnapshot');
const { enqueuePlanAdaptWeekly } = require('../../jobs/planAdaptWeeklyJobs');
const { isPlanQueueEnabled } = require('../redisBull');

/**
 * True when local time is Sunday 00:00–03:59 (weekly cron window).
 * @param {string} timezone
 * @param {Date} [now]
 */
function isWeeklyCronWindowForTimezone(timezone, now = new Date()) {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: 'numeric',
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const weekday = parts.find((p) => p.type === 'weekday')?.value;
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 99);
    return weekday === 'Sun' && hour >= 0 && hour < 4;
  } catch {
    const d = now.getUTCDay();
    return d === 0 && now.getUTCHours() < 4;
  }
}

/**
 * Athletes with an active Postgres plan (official AI coach users).
 */
async function listAthletesWithActivePlans({ limit = 1000 } = {}) {
  const rows = await prisma.user.findMany({
    where: {
      role: 'athlete',
      OR: [
        { workoutPlans: { some: { status: 'active' } } },
        { dietPlans: { some: { status: 'active' } } },
      ],
    },
    select: {
      id: true,
      settings: { select: { language: true, timezone: true } },
    },
    take: limit,
  });
  return rows.map((u) => ({
    userId: u.id,
    locale: u.settings?.language === 'en' ? 'en' : 'ar',
    timezone: u.settings?.timezone || 'UTC',
  }));
}

/**
 * @param {{
 *   respectTimezoneWindow?: boolean,
 *   dryRun?: boolean,
 *   precomputeMetrics?: boolean,
 * }} [opts]
 */
async function runWeeklyAdaptBatch(opts = {}) {
  const respectWindow = opts.respectTimezoneWindow !== false;
  const dryRun = Boolean(opts.dryRun);
  const precompute = opts.precomputeMetrics !== false;

  if (!dryRun && !isPlanQueueEnabled()) {
    return { ok: false, reason: 'queue_disabled', enqueued: 0, scanned: 0 };
  }

  const athletes = await listAthletesWithActivePlans();
  const reviewWeek = completedReviewWeekStart();
  const { startIso } = weekRange(reviewWeek);

  let scanned = 0;
  let enqueued = 0;
  let notified = 0;
  let metricsWritten = 0;
  let skippedWindow = 0;
  const errors = [];

  for (const athlete of athletes) {
    scanned += 1;

    if (respectWindow && !isWeeklyCronWindowForTimezone(athlete.timezone)) {
      skippedWindow += 1;
      continue;
    }

    try {
      const status = await getWeeklyReviewStatus(athlete.userId, {
        weekStart: startIso,
        locale: athlete.locale,
      });

      if (!status.weekEnded) continue;

      if (precompute && !status.submitted) {
        if (!dryRun) {
          await ensureWeeklyMetricsSnapshot(athlete.userId, {
            weekStart: startIso,
            timezone: athlete.timezone,
            locale: athlete.locale,
          });
        }
        metricsWritten += 1;
      }

      const shouldEnqueue = status.due || (status.missing?.length > 0 && !status.submitted);
      if (!shouldEnqueue) continue;

      if (dryRun) {
        enqueued += 1;
        if (status.missing?.length) notified += 1;
        continue;
      }

      const r = await enqueuePlanAdaptWeekly({
        userId: athlete.userId,
        weekStart: startIso,
        locale: athlete.locale,
        notifyOnly: status.missing?.length > 0,
      });

      if (r.ok) {
        enqueued += 1;
        if (status.missing?.length) notified += 1;
      }
    } catch (err) {
      errors.push({ userId: athlete.userId, message: err.message });
      logger.warn({ err: err.message, userId: athlete.userId }, 'weekly adapt batch row failed');
    }
  }

  return {
    ok: true,
    dryRun,
    weekStart: startIso,
    scanned,
    enqueued,
    notified,
    metricsWritten,
    skippedWindow,
    errors: errors.slice(0, 20),
  };
}

module.exports = {
  runWeeklyAdaptBatch,
  listAthletesWithActivePlans,
  isWeeklyCronWindowForTimezone,
};
