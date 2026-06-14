/**
 * Block D1 — batch enqueue mid-week checks (Wed 09:00–13:59 local).
 */
const { prisma } = require('../../db');
const { logger } = require('../logger');
const { isPlanQueueEnabled } = require('../redisBull');
const { enqueuePlanMidWeek } = require('../../jobs/planMidWeekJobs');
const { calendarDateOnly } = require('../plans/planCalendar');
const { weekStartSundayUtc } = require('../plans/planWeek');

function isMidWeekCronWindowForTimezone(timezone, now = new Date()) {
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
    return weekday === 'Wed' && hour >= 9 && hour < 14;
  } catch {
    const d = now.getUTCDay();
    return d === 3 && now.getUTCHours() >= 9 && now.getUTCHours() < 14;
  }
}

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
 * @param {{ respectTimezoneWindow?: boolean, dryRun?: boolean }} [opts]
 */
async function runMidWeekBatch(opts = {}) {
  const respectWindow = opts.respectTimezoneWindow !== false;
  const dryRun = Boolean(opts.dryRun);

  if (!dryRun && !isPlanQueueEnabled()) {
    return { ok: false, reason: 'queue_disabled', enqueued: 0, scanned: 0 };
  }

  const athletes = await listAthletesWithActivePlans();
  const now = new Date();
  let scanned = 0;
  let enqueued = 0;
  let skippedWindow = 0;

  for (const athlete of athletes) {
    scanned += 1;
    if (respectWindow && !isMidWeekCronWindowForTimezone(athlete.timezone, now)) {
      skippedWindow += 1;
      continue;
    }

    const weekStart = calendarDateOnly(weekStartSundayUtc(now), athlete.timezone)
      .toISOString()
      .slice(0, 10);

    if (dryRun) {
      enqueued += 1;
      continue;
    }

    const result = await enqueuePlanMidWeek({
      userId: athlete.userId,
      locale: athlete.locale,
      weekStart,
    });
    if (result.ok) enqueued += 1;
  }

  if (enqueued > 0) {
    logger.info({ scanned, enqueued, skippedWindow, dryRun }, 'mid-week batch complete');
  }

  return { ok: true, scanned, enqueued, skippedWindow, dryRun };
}

module.exports = { runMidWeekBatch, isMidWeekCronWindowForTimezone };
