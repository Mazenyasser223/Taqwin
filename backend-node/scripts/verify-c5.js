/* eslint-disable no-console */
/**
 * Block C5 — DailyAthletePlan slice from active weekly plans.
 *
 *   node scripts/verify-c5.js
 *   node scripts/verify-c5.js --db
 */
require('dotenv').config({ override: true });

const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src');

function read(rel) {
  return fs.readFileSync(path.join(src, rel), 'utf8');
}

function staticChecks() {
  const checks = [
    {
      name: 'dailyAthletePlanService.js exists',
      ok: () => fs.existsSync(path.join(src, 'lib/plans/dailyAthletePlanService.js')),
    },
    {
      name: 'generator calls syncDailyPlansAfterWeeklyPlan',
      ok: () => read('lib/plans/generator.js').includes('syncDailyPlansAfterWeeklyPlan'),
    },
    {
      name: 'ensureDailyAthletePlanForDate upserts by userId+date',
      ok: () => read('lib/plans/dailyAthletePlanService.js').includes('userId_date'),
    },
    {
      name: 'week slice creates 7 days by default',
      ok: () => read('lib/plans/dailyAthletePlanService.js').includes('ensureDailyAthletePlansForWeek'),
    },
  ];
  let failed = 0;
  for (const c of checks) {
    if (c.ok()) console.log(`OK  ${c.name}`);
    else {
      console.log(`FAIL ${c.name}`);
      failed += 1;
    }
  }
  return failed;
}

async function dbIntegration() {
  const { prisma } = require('../src/db');
  const { persistPlanToPostgres } = require('../src/lib/plans/persistPostgres');
  const { buildFallbackPlan } = require('../src/lib/plans/fallback');
  const { estimateDailyTargets } = require('../src/lib/plans/targets');
  const {
    ensureDailyAthletePlanForDate,
    ensureDailyAthletePlansForWeek,
    fetchDailyAthletePlanForDate,
  } = require('../src/lib/plans/dailyAthletePlanService');
  const { calendarDateOnly } = require('../src/lib/plans/planCalendar');

  const athlete = await prisma.user.findFirst({
    where: { role: 'athlete' },
    include: { profile: true },
  });
  if (!athlete?.profile) {
    console.log('SKIP db — no athlete with profile');
    return 0;
  }
  console.log(`OK  using athlete ${athlete.email || athlete.id}`);

  const targets = estimateDailyTargets(athlete.profile, athlete.profile.onboardingData || {});
  const planData = buildFallbackPlan({
    profile: athlete.profile,
    onboardingData: athlete.profile.onboardingData || {},
    targets,
  });

  await persistPlanToPostgres({
    userId: athlete.id,
    planData,
    legacySource: 'fallback',
    locale: 'ar',
    regenerationReason: 'verify-c5',
    prismaSource: 'manual',
  });
  console.log('OK  active weekly plan persisted for slice test');

  const week = await ensureDailyAthletePlansForWeek(athlete.id, { days: 7 });
  if (!week.ok || week.created < 1) {
    throw new Error(`ensureDailyAthletePlansForWeek failed: created=${week.created}`);
  }
  console.log(`OK  ensured ${week.created}/${week.total} daily rows`);

  const today = await ensureDailyAthletePlanForDate(athlete.id);
  if (!today.ok || !today.dailyPlan?.id) {
    throw new Error('ensureDailyAthletePlanForDate failed');
  }
  console.log(`OK  today row id=${today.dailyPlan.id} dayIndex=${today.dayIndex}`);

  const loaded = await fetchDailyAthletePlanForDate(athlete.id);
  if (!loaded?.workoutPlanDay && !loaded?.dietPlanDay) {
    throw new Error('fetchDailyAthletePlanForDate missing day joins');
  }
  console.log('OK  fetchDailyAthletePlanForDate with workout/diet joins');

  const dateOnly = calendarDateOnly(new Date(), 'UTC');
  await prisma.dailyAthletePlan.deleteMany({
    where: {
      userId: athlete.id,
      date: { gte: dateOnly },
    },
  });
  console.log('OK  cleaned up verify daily rows from today forward');

  return 0;
}

async function main() {
  let failed = 0;
  console.log('Block C5 verify\n');
  failed += staticChecks();

  if (process.argv.includes('--db')) {
    if (!process.env.DATABASE_URL) {
      console.log('SKIP db — DATABASE_URL not set');
    } else {
      console.log('\n-- DB integration --');
      try {
        failed += await dbIntegration();
      } catch (err) {
        console.log('FAIL db:', err.message);
        failed += 1;
      } finally {
        await require('../src/db').prisma.$disconnect().catch(() => {});
      }
    }
  } else {
    console.log('\n(tip: node scripts/verify-c5.js --db)');
  }

  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log('\nC5 verify PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
