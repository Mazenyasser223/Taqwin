/**
 * Block C11 — batch enqueue daily DailyAthletePlan refresh jobs.
 */
const { prisma } = require('../../db');
const { logger } = require('../logger');
const { calendarDateOnly } = require('./planCalendar');
const { enqueuePlanDailyRefresh } = require('../../jobs/planDailyRefreshJobs');
const { isPlanQueueEnabled } = require('../redisBull');

/**
 * Local time 00:00–01:59 (architecture: daily refresh ~00:05 user TZ).
 * @param {string} timezone
 * @param {Date} [now]
 */
function isDailyCronWindowForTimezone(timezone, now = new Date()) {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    const hour = Number(fmt.format(now));
    return hour >= 0 && hour < 2;
  } catch {
    return now.getUTCHours() < 2;
  }
}

async function listAthletesWithActivePlans({ limit = 2000 } = {}) {
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
      settings: { select: { timezone: true } },
    },
    take: limit,
  });
  return rows.map((u) => ({
    userId: u.id,
    timezone: u.settings?.timezone || 'UTC',
  }));
}

/**
 * @param {{
 *   respectTimezoneWindow?: boolean,
 *   dryRun?: boolean,
 *   days?: number,
 * }} [opts]
 */
async function runDailyRefreshBatch(opts = {}) {
  const respectWindow = opts.respectTimezoneWindow !== false;
  const dryRun = Boolean(opts.dryRun);
  const days = Math.max(1, Math.min(Number(opts.days) || 7, 14));

  if (!dryRun && !isPlanQueueEnabled()) {
    return { ok: false, reason: 'queue_disabled', enqueued: 0, scanned: 0 };
  }

  const athletes = await listAthletesWithActivePlans();
  const now = new Date();

  let scanned = 0;
  let enqueued = 0;
  let skippedWindow = 0;
  const errors = [];

  for (const athlete of athletes) {
    scanned += 1;

    if (respectWindow && !isDailyCronWindowForTimezone(athlete.timezone, now)) {
      skippedWindow += 1;
      continue;
    }

    const dateKey = calendarDateOnly(now, athlete.timezone).toISOString().slice(0, 10);

    try {
      if (dryRun) {
        enqueued += 1;
        continue;
      }

      const r = await enqueuePlanDailyRefresh({
        userId: athlete.userId,
        timezone: athlete.timezone,
        days,
        dateKey,
      });

      if (r.ok) enqueued += 1;
    } catch (err) {
      errors.push({ userId: athlete.userId, message: err.message });
      logger.warn({ err: err.message, userId: athlete.userId }, 'daily refresh batch row failed');
    }
  }

  return {
    ok: true,
    dryRun,
    days,
    scanned,
    enqueued,
    skippedWindow,
    errors: errors.slice(0, 20),
  };
}

module.exports = {
  runDailyRefreshBatch,
  listAthletesWithActivePlans,
  isDailyCronWindowForTimezone,
};
