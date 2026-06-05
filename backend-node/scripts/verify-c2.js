/* eslint-disable no-console */
/**
 * Block C2 verify — validation gate + Postgres persist + active plan read path.
 *
 *   node scripts/verify-c2.js           # unit checks (no DB)
 *   node scripts/verify-c2.js --db    # + validator smoke (needs DATABASE_URL)
 */
require('dotenv').config({ override: true });

const { validatePlanForPersist } = require('../src/lib/plans/planValidation');
const { buildFallbackPlan } = require('../src/lib/plans/fallback');
const { estimateDailyTargets } = require('../src/lib/plans/targets');
const {
  persistPlanToPostgres,
  fetchActivePlanFromPostgres,
  toLegacyPlanDocument,
} = require('../src/lib/plans/persistPostgres');
const { fetchActivePlan } = require('../src/services/activePlanService');
const { weekStartIso } = require('../src/lib/plans/planWeek');

const DEMO_USER =
  process.env.C2_VERIFY_USER_ID || '11111111-1111-4111-8111-111111111111';

function ok(msg) {
  console.log(`OK  ${msg}`);
}

function fail(msg) {
  console.error(`FAIL ${msg}`);
}

async function unitChecks() {
  const errors = [];

  const profile = {
    gender: 'male',
    weight: 80,
    fitnessGoal: 'muscle',
    onboardingData: { trainingDaysPerWeek: '4', mealsPerDay: '3', snacksPerDay: '1' },
  };
  const targets = estimateDailyTargets(profile);
  const plan = buildFallbackPlan({ profile, onboardingData: profile.onboardingData, targets });

  if (!plan.dietDays || plan.dietDays.length !== 7) {
    errors.push(`fallback dietDays: ${plan.dietDays?.length}`);
  }
  if (!plan.workoutWeeks || plan.workoutWeeks.length < 1) {
    errors.push(`fallback workoutWeeks: ${plan.workoutWeeks?.length}`);
  }
  ok(`fallback plan shape (7 diet days, ${plan.workoutWeeks.length} workout weeks)`);

  const legacy = toLegacyPlanDocument({
    userId: DEMO_USER,
    workoutPlan: { id: 'wp-test', createdAt: new Date(), updatedAt: new Date() },
    dietPlan: { id: 'dp-test', createdAt: new Date(), updatedAt: new Date() },
    planData: plan,
    legacySource: 'fallback',
    locale: 'en',
    version: 1,
  });
  if (!legacy.dailyTargets?.calories || !legacy.postgres?.workoutPlanId) {
    errors.push('toLegacyPlanDocument missing fields');
  } else {
    ok('toLegacyPlanDocument maps postgres ids + dailyTargets');
  }

  const ws = weekStartIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ws)) errors.push(`weekStartIso: ${ws}`);
  else ok(`weekStartIso -> ${ws}`);

  return { errors, plan, profile, targets };
}

async function dbChecks(plan, profile) {
  const errors = [];
  if (!process.env.DATABASE_URL) {
    fail('DATABASE_URL not set — skip --db checks');
    return errors;
  }

  const { prisma } = require('../src/db');

  let userId = DEMO_USER;
  let user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    const fallback = await prisma.user.findFirst({
      where: { role: 'athlete' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true },
    });
    if (fallback) {
      userId = fallback.id;
      user = fallback;
      ok(`using athlete user ${fallback.email || userId}`);
    } else {
      errors.push(
        'no User in DB — run npm run db:seed or set C2_VERIFY_USER_ID'
      );
      await prisma.$disconnect().catch(() => {});
      return errors;
    }
  }

  const validation = await validatePlanForPersist(plan, {
    profile,
    onboardingData: profile.onboardingData,
  });
  if (!validation.ok) {
    errors.push(`validatePlanForPersist fallback: ${validation.errors.slice(0, 3).join('; ')}`);
  } else {
    ok(`validatePlanForPersist (${validation.errors.length} errors)`);
  }

  let saved;
  try {
    saved = await persistPlanToPostgres({
      userId,
      planData: plan,
      legacySource: 'fallback',
      locale: 'en',
      regenerationReason: 'verify-c2',
      explainabilityText: 'C2 verify script',
    });
    ok(`persistPlanToPostgres workout=${saved.postgres.workoutPlanId} diet=${saved.postgres.dietPlanId}`);
  } catch (err) {
    errors.push(`persistPlanToPostgres: ${err.message}`);
    return errors;
  }

  const fromPg = await fetchActivePlanFromPostgres(userId);
  if (!fromPg || fromPg.dietDays.length < 1) {
    errors.push('fetchActivePlanFromPostgres returned empty');
  } else {
    ok(`fetchActivePlanFromPostgres (${fromPg.dietDays.length} diet days)`);
  }

  const unified = await fetchActivePlan(userId);
  if (!unified || unified.userId !== userId) {
    errors.push('fetchActivePlan unified read failed');
  } else {
    ok(`fetchActivePlan prefers Postgres (source=${unified.source})`);
  }

  const activeWorkout = await prisma.workoutPlan.findFirst({
    where: { userId, status: 'active' },
  });
  const activeDiet = await prisma.dietPlan.findFirst({
    where: { userId, status: 'active' },
  });
  if (!activeWorkout || !activeDiet) {
    errors.push('no active WorkoutPlan/DietPlan row');
  } else {
    ok('Prisma active WorkoutPlan + DietPlan rows exist');
  }

  await prisma.workoutPlan.updateMany({
    where: { userId },
    data: { status: 'archived' },
  });
  await prisma.dietPlan.updateMany({
    where: { userId },
    data: { status: 'archived' },
  });
  ok('cleaned up verify user plans (archived)');

  await prisma.$disconnect().catch(() => {});
  return errors;
}

async function main() {
  const withDb = process.argv.includes('--db');
  console.log('Block C2 verify\n');

  const { errors: unitErrors, plan, profile } = await unitChecks();
  const allErrors = [...unitErrors];

  if (withDb) {
    console.log('\n-- DB integration --');
    const dbErrors = await dbChecks(plan, profile);
    allErrors.push(...dbErrors);
  } else {
    console.log('\n(tip: node scripts/verify-c2.js --db for Postgres integration)');
  }

  if (allErrors.length) {
    console.error('\nC2 verify FAILED:');
    allErrors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log('\nC2 verify PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
