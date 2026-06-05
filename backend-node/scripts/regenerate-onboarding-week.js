#!/usr/bin/env node
/** One-off: regenerate plan with onboarding_complete so weekStart = completion day. */
require('dotenv').config({ override: true });
const { prisma } = require('../src/db');
const { generatePlanForUser } = require('../src/lib/plans/generator');
const { syncDailyPlansAfterWeeklyPlan } = require('../src/lib/plans/dailyAthletePlanService');

async function main() {
  const email = (process.argv[2] || 'magdyzeyad54@gmail.com').trim().toLowerCase();
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    console.error('User not found:', email);
    process.exit(1);
  }

  console.log('Regenerating Claude plan for', email, '(onboarding_complete weekStart)...');
  const result = await generatePlanForUser({
    userId: user.id,
    locale: 'ar',
    regenerationReason: 'onboarding_complete',
  });

  const slice = await syncDailyPlansAfterWeeklyPlan(user.id, { days: 7 });

  const wp = await prisma.workoutPlan.findFirst({
    where: { userId: user.id, status: 'active' },
    orderBy: { weekStart: 'desc' },
    select: { weekStart: true, explainabilityText: true, source: true },
  });

  console.log('OK', {
    source: result.source,
    attempts: result.attempts,
    storage: result.storage,
    weekStart: wp?.weekStart?.toISOString?.().slice(0, 10),
    planSource: wp?.source,
    dailySlice: slice.created,
    explainability: (wp?.explainabilityText || result.plan?.explainabilityText || '').slice(0, 100),
  });
}

main()
  .catch((err) => {
    console.error('FAIL', err.message);
    if (err.validationErrors) console.error(err.validationErrors.slice(0, 8));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
