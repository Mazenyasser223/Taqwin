#!/usr/bin/env node
/**
 * Block C9 verification — adaptation engine + weekly review API shape.
 *
 *   node scripts/verify-c9.js
 *   node scripts/verify-c9.js --email user@example.com
 */
require('dotenv').config({ override: true });

const { evaluateAdaptation } = require('../src/lib/adaptation/adaptationEngine');
const { getWeeklyReviewStatus } = require('../src/lib/adaptation/weeklyReview');
const { prisma } = require('../src/db');

const email = process.argv.includes('--email')
  ? process.argv[process.argv.indexOf('--email') + 1]
  : process.env.VERIFY_USER_EMAIL;

async function main() {
  let failed = 0;

  const keep = evaluateAdaptation({ overallAdherence: 90, missedWorkoutDays: 0, painReports: 0, plateauWeeks: 0 });
  if (keep.decision !== 'keep') {
    console.error('FAIL: expected keep for 90% adherence');
    failed += 1;
  } else {
    console.log('OK: engine keep @ 90%');
  }

  const meso = evaluateAdaptation({ overallAdherence: 55, missedWorkoutDays: 4, painReports: 0, plateauWeeks: 0 });
  if (meso.decision !== 'meso' && meso.decision !== 'macro') {
    console.error('FAIL: expected meso/macro for missed days', meso.decision);
    failed += 1;
  } else {
    console.log('OK: engine meso/macro on missed days →', meso.decision);
  }

  if (!process.env.DATABASE_URL?.trim()) {
    console.log('SKIP: DATABASE_URL not set — DB weekly review check omitted');
    process.exit(failed ? 1 : 0);
  }

  let userId = null;
  if (email) {
    const user = await prisma.user.findFirst({ where: { email }, select: { id: true, role: true } });
    if (!user) {
      console.error('FAIL: user not found', email);
      process.exit(1);
    }
    if (user.role !== 'athlete') {
      console.error('FAIL: user is not athlete');
      process.exit(1);
    }
    userId = user.id;
  } else {
    const athlete = await prisma.user.findFirst({
      where: { role: 'athlete' },
      select: { id: true, email: true },
    });
    userId = athlete?.id;
    if (athlete?.email) console.log('Using athlete', athlete.email);
  }

  if (!userId) {
    console.log('SKIP: no athlete user for weekly review status');
    process.exit(failed ? 1 : 0);
  }

  const status = await getWeeklyReviewStatus(userId);
  const required = ['due', 'weekStart', 'missing', 'preview', 'adherence'];
  for (const k of required) {
    if (status[k] === undefined) {
      console.error('FAIL: weekly review missing field', k);
      failed += 1;
    }
  }
  if (!failed) {
    console.log('OK: weekly review status', {
      weekStart: status.weekStart,
      due: status.due,
      missing: status.missing,
      previewDecision: status.preview?.decision,
    });
  }

  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
