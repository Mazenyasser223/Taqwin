/* eslint-disable no-console */
/**
 * Block C7 verification — dashboard athlete/home uses C6 daily plan.
 *
 *   node scripts/verify-c7.js
 *   node scripts/verify-c7.js --db
 */
require('dotenv').config({ override: true });

const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src');

function read(rel) {
  return fs.readFileSync(path.join(src, rel), 'utf8');
}

function staticChecks() {
  const dash = read('routes/dashboard.js');
  const checks = [
    {
      name: 'dashboardTodayPlan.js exists',
      ok: () => fs.existsSync(path.join(src, 'lib/plans/dashboardTodayPlan.js')),
    },
    {
      name: 'dashboard imports loadDashboardTodayPlanContext',
      ok: () => dash.includes('loadDashboardTodayPlanContext'),
    },
    {
      name: 'athlete/home returns todayPlan',
      ok: () => dash.includes('todayPlan:'),
    },
    {
      name: 'athlete/home returns progressSummary',
      ok: () => dash.includes('progressSummary'),
    },
    {
      name: 'athlete/home returns nextAction',
      ok: () => dash.includes('nextAction'),
    },
    {
      name: 'athlete/home returns todayWorkout + todayDiet',
      ok: () => dash.includes('todayWorkout:') && dash.includes('todayDiet:'),
    },
    {
      name: 'C6 preferred for meals when c6Today',
      ok: () => dash.includes('c6Today?.meals'),
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
  const { loadDashboardTodayPlanContext } = require('../src/lib/plans/dashboardTodayPlan');
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
    regenerationReason: 'verify-c7',
    prismaSource: 'manual',
  });

  const ctx = await loadDashboardTodayPlanContext(athlete.id, new Date(), 'ar');
  if (!ctx) throw new Error('loadDashboardTodayPlanContext returned null');
  if (!ctx.formatted?.workout) throw new Error('missing formatted workout');
  if (!ctx.targets?.calorieTarget) throw new Error('missing targets');
  console.log(
    `OK  loadDashboardTodayPlanContext meals=${ctx.meals.length} exercises=${ctx.exercises.length} storage=${ctx.storage}`
  );
  return 0;
}

async function main() {
  let failed = 0;
  console.log('Block C7 verify\n');
  failed += staticChecks();
  if (process.argv.includes('--db')) {
    console.log('');
    try {
      failed += await dbIntegration();
    } catch (err) {
      console.error('FAIL db', err.message);
      failed += 1;
    } finally {
      const { prisma } = require('../src/db');
      await prisma.$disconnect();
    }
  } else {
    console.log('\n(tip) node scripts/verify-c7.js --db');
  }
  console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
}

main();
