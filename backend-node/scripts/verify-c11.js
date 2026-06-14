#!/usr/bin/env node
/**
 * Block C11 — daily refresh worker verification.
 */
require('dotenv').config({ override: true });

const { isDailyCronWindowForTimezone } = require('../src/lib/plans/dailyRefreshBatch');
const { runDailyRefreshForUser } = require('../src/lib/plans/runDailyRefresh');
const { fetchDailyAthletePlanForDate } = require('../src/lib/plans/dailyAthletePlanService');
const { acquireDailyRefreshLock, releaseDailyRefreshLock } = require('../src/lib/plans/dailyRefreshLock');
const { prisma } = require('../src/db');
const { isPlanQueueEnabled } = require('../src/lib/redisBull');
const { getPlanDailyRefreshQueue, PLAN_DAILY_REFRESH_QUEUE } = require('../src/jobs/queues');

async function main() {
  let failed = 0;

  if (PLAN_DAILY_REFRESH_QUEUE !== 'plan-daily-refresh') {
    console.error('FAIL: queue name');
    failed += 1;
  } else {
    console.log('OK: queue name plan-daily-refresh');
  }

  const midnight = isDailyCronWindowForTimezone('UTC', new Date('2026-06-03T00:30:00Z'));
  if (!midnight) {
    console.error('FAIL: expected 00:30 UTC in daily window');
    failed += 1;
  } else {
    console.log('OK: daily cron window (midnight)');
  }

  const noon = isDailyCronWindowForTimezone('UTC', new Date('2026-06-03T12:00:00Z'));
  if (noon) {
    console.error('FAIL: noon should not be daily window');
    failed += 1;
  } else {
    console.log('OK: noon rejected');
  }

  console.log('Queue enabled:', isPlanQueueEnabled());
  console.log('Bull queue instance:', getPlanDailyRefreshQueue() ? 'yes' : 'no');

  if (!process.env.DATABASE_URL?.trim()) {
    console.log('SKIP: DATABASE_URL — inline refresh test omitted');
    process.exit(failed ? 1 : 0);
  }

  const athlete = await prisma.user.findFirst({
    where: {
      role: 'athlete',
      OR: [
        { workoutPlans: { some: { status: 'active' } } },
        { dietPlans: { some: { status: 'active' } } },
      ],
    },
    select: { id: true, email: true, settings: { select: { timezone: true } } },
  });

  if (!athlete) {
    console.log('SKIP: no athlete with active plan');
    process.exit(failed ? 1 : 0);
  }

  const lock = await acquireDailyRefreshLock(athlete.id);
  if (lock.acquired) await releaseDailyRefreshLock(athlete.id);
  console.log('Lock:', lock.acquired ? 'ok' : lock.reason);

  const tz = athlete.settings?.timezone || 'UTC';
  const refresh = await runDailyRefreshForUser(athlete.id, { timezone: tz, days: 7 });
  if (!refresh.ok) {
    console.error('FAIL: runDailyRefreshForUser', refresh.reason);
    failed += 1;
  } else {
    console.log('OK: daily refresh', {
      email: athlete.email,
      created: refresh.created,
      total: refresh.total,
      dateKey: refresh.dateKey,
    });
  }

  const row = await fetchDailyAthletePlanForDate(athlete.id);
  if (!row) {
    console.error('FAIL: no DailyAthletePlan row for today after refresh');
    failed += 1;
  } else {
    console.log('OK: DailyAthletePlan row exists', {
      date: row.date.toISOString().slice(0, 10),
      workoutDay: Boolean(row.workoutPlanDayId),
      dietDay: Boolean(row.dietPlanDayId),
    });
  }

  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
