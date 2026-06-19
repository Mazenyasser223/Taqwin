/* eslint-disable no-console */
/**
 * Backfill foodItemId links on active diet plan meal items (webteb → FoodItem).
 *   node scripts/backfill-diet-plan-food-links.js mazenyasser223@gmail.com
 */
require('dotenv').config({ override: true });

const { prisma } = require('../src/db');
const { loadActivePlanDays } = require('../src/lib/plans/dailyAthletePlanService');
const { formatWeekPlanResponse } = require('../src/lib/plans/planApiFormat');

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email) {
    console.error('Usage: node scripts/backfill-diet-plan-food-links.js <email>');
    process.exit(1);
  }
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    console.error('User not found:', email);
    process.exit(1);
  }

  const { workoutPlan, dietPlan } = await loadActivePlanDays(user.id, { detailed: true });
  if (!dietPlan) {
    console.error('No active diet plan');
    process.exit(1);
  }

  const week = formatWeekPlanResponse({ workoutPlan, dietPlan, dailyPlans: [] });
  const day1 = week?.diet?.days?.find((d) => d.dayIndex === 3) || week?.diet?.days?.[0];
  const sample = day1?.meals?.[0];
  console.log('OK backfill complete', {
    dietPlanId: dietPlan.id,
    dayIndex: day1?.dayIndex,
    sampleMeal: sample
      ? {
          name: sample.name,
          grams: sample.grams,
          calories: sample.calories,
          protein: sample.protein,
          foodItemId: sample.foodItemId,
        }
      : null,
    day1TotalKcal: (day1?.meals || []).reduce((s, m) => s + (m.calories || 0), 0),
  });
}

main()
  .catch((err) => {
    console.error('FAIL', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
