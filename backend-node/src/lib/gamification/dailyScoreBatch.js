/**
 * Batch job — compute daily fitness scores for active athletes.
 */
const { prisma } = require('../../db');
const { addCalendarDays, calendarDateOnly } = require('../plans/planCalendar');
const { computeAndPersistDailyScore } = require('../fitnessScoreCompute');
const { resolveAthleteTimezone } = require('../athleteMetrics');

const ACTIVE_SINCE_DAYS = 35;

async function listActiveAthleteIds({ limit = 5000 } = {}) {
  const since = addCalendarDays(new Date(), -ACTIVE_SINCE_DAYS);
  const rows = await prisma.user.findMany({
    where: {
      role: 'athlete',
      OR: [
        { lastSeenAt: { gte: since } },
        { foodLogs: { some: { loggedAt: { gte: since } } } },
        { workoutLogs: { some: { loggedAt: { gte: since } } } },
        { exerciseLogs: { some: { loggedAt: { gte: since } } } },
      ],
    },
    select: { id: true },
    take: limit,
  });
  return rows.map((r) => r.id);
}

/**
 * For each athlete whose local time is in the 02:00–03:59 window, compute yesterday's score.
 */
async function runDailyScoreBatch({ dryRun = false, now = new Date(), userIds = null } = {}) {
  const ids = userIds || (await listActiveAthleteIds());
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const userId of ids) {
    try {
      const timezone = await resolveAthleteTimezone(userId);
      const localNow = calendarDateOnly(now, timezone);
      const hour = Number(
        now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: timezone })
      );

      if (userIds == null && (hour < 2 || hour >= 4)) {
        skipped += 1;
        continue;
      }

      const yesterday = addCalendarDays(localNow, -1);
      const dateKey = yesterday.toISOString().slice(0, 10);

      if (!dryRun) {
        await computeAndPersistDailyScore(userId, dateKey, { source: 'cron', timezone });
      }
      processed += 1;
    } catch {
      errors += 1;
    }
  }

  return {
    ok: errors === 0,
    dryRun,
    candidates: ids.length,
    processed,
    skipped,
    errors,
  };
}

/**
 * On-demand: compute today + backfill recent days for one user.
 */
async function backfillRecentScores(userId, days = 7, source = 'on_demand') {
  const timezone = await resolveAthleteTimezone(userId);
  const today = calendarDateOnly(new Date(), timezone);
  const results = [];

  for (let i = 0; i < days; i += 1) {
    const d = addCalendarDays(today, -i);
    const dateKey = d.toISOString().slice(0, 10);
    const row = await computeAndPersistDailyScore(userId, dateKey, { source, timezone });
    results.push({ dateKey, score: row.score });
  }

  return results;
}

module.exports = {
  listActiveAthleteIds,
  runDailyScoreBatch,
  backfillRecentScores,
};
