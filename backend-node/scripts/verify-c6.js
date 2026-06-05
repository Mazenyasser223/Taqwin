/* eslint-disable no-console */
/**
 * Block C6 verification — GET /api/plans/today and /api/plans/week.
 *
 *   node scripts/verify-c6.js
 *   node scripts/verify-c6.js --db
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
    { name: 'routes/plans.js exists', ok: () => fs.existsSync(path.join(src, 'routes/plans.js')) },
    {
      name: 'app mounts /api/plans',
      ok: () => fs.readFileSync(path.join(src, 'app.js'), 'utf8').includes("app.use('/api/plans', plansRoutes)"),
    },
    {
      name: 'GET /today uses resolveTodayPlan',
      ok: () => read('routes/plans.js').includes('resolveTodayPlan'),
    },
    {
      name: 'GET /week uses formatWeekPlanResponse',
      ok: () => read('routes/plans.js').includes('formatWeekPlanResponse'),
    },
    {
      name: 'planApiFormat.js exports formatters',
      ok: () => read('lib/plans/planApiFormat.js').includes('formatTodayPlanResponse'),
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
  const { resolveTodayPlan, loadActivePlanDays } = require('../src/lib/plans/dailyAthletePlanService');
  const { formatTodayPlanResponse, formatWeekPlanResponse } = require('../src/lib/plans/planApiFormat');
  const { persistPlanToPostgres } = require('../src/lib/plans/persistPostgres');
  const { buildFallbackPlan } = require('../src/lib/plans/fallback');
  const { estimateDailyTargets } = require('../src/lib/plans/targets');
  const { prisma } = require('../src/db');

  const athlete = await prisma.user.findFirst({
    where: { role: 'athlete' },
    include: { profile: true },
  });
  if (!athlete?.profile) {
    console.log('SKIP db — no athlete');
    return 0;
  }

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
    regenerationReason: 'verify-c6',
    prismaSource: 'manual',
  });

  const today = await resolveTodayPlan(athlete.id);
  if (!today.ok) throw new Error(`resolveTodayPlan failed: ${today.reason}`);
  const todayJson = formatTodayPlanResponse(today);
  if (!todayJson.workout || !todayJson.diet) throw new Error('today payload missing sections');
  console.log(`OK  resolveTodayPlan dayIndex=${todayJson.dayIndex} exercises=${todayJson.workout.exercises.length}`);

  const { workoutPlan, dietPlan } = await loadActivePlanDays(athlete.id, { detailed: true });
  const week = formatWeekPlanResponse({ workoutPlan, dietPlan, dailyPlans: [] });
  if (!week?.workout?.days?.length) throw new Error('week payload missing workout days');
  console.log(`OK  formatWeekPlanResponse workoutDays=${week.workout.days.length}`);

  return 0;
}

async function main() {
  let failed = 0;
  console.log('Block C6 verify\n');
  failed += staticChecks();

  if (process.argv.includes('--db')) {
    if (!process.env.DATABASE_URL) {
      console.log('SKIP db — DATABASE_URL missing');
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
    console.log('\n(tip: node scripts/verify-c6.js --db)');
  }

  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log('\nC6 verify PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
