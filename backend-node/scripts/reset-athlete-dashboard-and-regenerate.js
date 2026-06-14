/* eslint-disable no-console */
/**
 * Reset athlete dashboard activity + official plans, then regenerate from onboarding.
 *
 *   node scripts/reset-athlete-dashboard-and-regenerate.js
 *   RESET_ATHLETE_EMAIL=you@example.com node scripts/reset-athlete-dashboard-and-regenerate.js
 */
require('dotenv').config({ override: true });

const { prisma } = require('../src/db');
const { generatePlanForUser } = require('../src/lib/plans/generator');
const { resolveTodayPlan } = require('../src/lib/plans/dailyAthletePlanService');
const { loadDashboardTodayPlanContext } = require('../src/lib/plans/dashboardTodayPlan');
const { isAthleteOnboardingFullyComplete } = require('../src/lib/plans/onboardingComplete');

async function findAthlete() {
  const email = (process.argv[2] || process.env.RESET_ATHLETE_EMAIL || '').trim().toLowerCase();
  if (email) {
    const user = await prisma.user.findFirst({
      where: { email, role: 'athlete' },
      include: { profile: true },
    });
    if (!user?.profile) throw new Error(`No athlete profile for ${email}`);
    return user;
  }

  const candidates = await prisma.user.findMany({
    where: { role: 'athlete' },
    include: { profile: true },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });

  const complete = candidates.filter((u) =>
    isAthleteOnboardingFullyComplete(u.profile?.onboardingData)
  );
  const pick = complete[0] || candidates[0];
  if (!pick?.profile) throw new Error('No athlete user found');
  return pick;
}

function stripCoachPlanFromOnboarding(onboardingData) {
  if (!onboardingData || typeof onboardingData !== 'object' || Array.isArray(onboardingData)) {
    return onboardingData;
  }
  const next = { ...onboardingData };
  delete next.coachPlan;
  delete next.coachPlanForceRegenerate;
  return next;
}

async function clearDashboardData(userId) {
  const food = await prisma.foodLog.deleteMany({ where: { userId } });
  const workouts = await prisma.workoutLog.deleteMany({ where: { userId } });
  const exercises = await prisma.exerciseLog.deleteMany({ where: { userId } });
  const daily = await prisma.dailyAthletePlan.deleteMany({ where: { userId } });
  const workoutPlans = await prisma.workoutPlan.deleteMany({ where: { userId } });
  const dietPlans = await prisma.dietPlan.deleteMany({ where: { userId } });
  return { food, workouts, exercises, daily, workoutPlans, dietPlans };
}

async function main() {
  const athlete = await findAthlete();
  const od =
    athlete.profile.onboardingData && typeof athlete.profile.onboardingData === 'object'
      ? athlete.profile.onboardingData
      : {};

  console.log('Athlete:', athlete.email, athlete.id);
  console.log('Onboarding complete:', isAthleteOnboardingFullyComplete(od));

  if (!isAthleteOnboardingFullyComplete(od)) {
    console.warn(
      'WARN: Not all 4 questionnaire timestamps set — plan will use partial onboarding + fallback.'
    );
    console.warn('Required keys: coreCompletedAt, workoutPlanCompletedAt, dietPlanCompletedAt, wellnessCompletedAt');
  }

  console.log('\n-- Clearing dashboard-visible data --');
  const cleared = await clearDashboardData(athlete.id);
  console.log('Deleted:', cleared);

  const cleanOd = stripCoachPlanFromOnboarding(od);
  await prisma.profile.update({
    where: { userId: athlete.id },
    data: { onboardingData: cleanOd },
  });
  console.log('OK  removed onboardingData.coachPlan (legacy coach UI)');

  console.log('\n-- Generating official Postgres plan from onboarding --');
  const result = await generatePlanForUser({
    userId: athlete.id,
    locale: 'ar',
    regenerationReason: 'dashboard_reset',
  });
  console.log('Plan result:', {
    source: result.source,
    storage: result.storage,
    workoutPlanId: result.workoutPlanId,
    dietPlanId: result.dietPlanId,
  });

  const today = await resolveTodayPlan(athlete.id);
  if (!today.ok) {
    throw new Error(`resolveTodayPlan failed: ${today.reason}`);
  }

  const dashCtx = await loadDashboardTodayPlanContext(athlete.id, new Date(), 'ar');
  if (!dashCtx) throw new Error('loadDashboardTodayPlanContext returned null');

  console.log('\n-- Today plan check --');
  console.log({
    date: dashCtx.date,
    isRest: dashCtx.isRest,
    exercises: dashCtx.exercises.length,
    meals: dashCtx.meals.length,
    calorieTarget: dashCtx.targets.calorieTarget,
    storage: dashCtx.storage,
    explainability: dashCtx.explainabilityText?.slice(0, 80) || null,
  });

  console.log('\nDone. Refresh athlete home in the app (hard refresh).');
}

main()
  .catch((err) => {
    console.error('FAIL:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
