#!/usr/bin/env node
/**
 * Block C10 — weekly worker + ProgressSnapshot verification.
 */
require('dotenv').config({ override: true });

const { isWeeklyCronWindowForTimezone } = require('../src/lib/adaptation/weeklyAdaptBatch');
const { ensureWeeklyMetricsSnapshot } = require('../src/lib/adaptation/progressSnapshot');
const { acquireWeeklyAdaptLock, releaseWeeklyAdaptLock } = require('../src/lib/adaptation/weeklyAdaptLock');
const { completedReviewWeekStart, weekRange } = require('../src/lib/adaptation/weekBounds');
const { prisma } = require('../src/db');
const { isPlanQueueEnabled } = require('../src/lib/redisBull');

async function main() {
  let failed = 0;

  const sunUtc = isWeeklyCronWindowForTimezone('UTC', new Date('2026-06-07T01:00:00Z'));
  if (!sunUtc) {
    console.error('FAIL: expected Sunday window for UTC');
    failed += 1;
  } else {
    console.log('OK: Sunday cron window detection');
  }

  const notSun = isWeeklyCronWindowForTimezone('UTC', new Date('2026-06-06T12:00:00Z'));
  if (notSun) {
    console.error('FAIL: Saturday should not be cron window');
    failed += 1;
  } else {
    console.log('OK: non-Sunday rejected');
  }

  console.log('Queue enabled:', isPlanQueueEnabled());

  if (!process.env.DATABASE_URL?.trim()) {
    console.log('SKIP: DATABASE_URL — snapshot DB test omitted');
    process.exit(failed ? 1 : 0);
  }

  const athlete = await prisma.user.findFirst({
    where: { role: 'athlete' },
    select: { id: true, email: true, settings: { select: { timezone: true, language: true } } },
  });

  if (!athlete) {
    console.log('SKIP: no athlete');
    process.exit(failed ? 1 : 0);
  }

  const weekStart = completedReviewWeekStart();
  const { startIso } = weekRange(weekStart);

  const lock = await acquireWeeklyAdaptLock(athlete.id);
  console.log('Lock:', lock.acquired ? 'ok' : lock.reason);
  if (lock.acquired) await releaseWeeklyAdaptLock(athlete.id);

  try {
    const snap = await ensureWeeklyMetricsSnapshot(athlete.id, {
      weekStart: startIso,
      timezone: athlete.settings?.timezone || 'UTC',
      locale: athlete.settings?.language === 'en' ? 'en' : 'ar',
    });
    if (!snap.snapshot?.id) {
      console.error('FAIL: metrics snapshot missing id');
      failed += 1;
    } else {
      console.log('OK: ProgressSnapshot metrics', {
        email: athlete.email,
        weekStart: startIso,
        adherencePct: snap.snapshot.adherencePct,
        preview: snap.previewDecision,
      });
    }
  } catch (err) {
    console.error('FAIL: ensureWeeklyMetricsSnapshot', err.message);
    failed += 1;
  }

  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
