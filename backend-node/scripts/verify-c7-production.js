/**
 * Production readiness checks for Blocks C6–C7 (official week plan on dashboard home).
 *
 *   node scripts/verify-c7-production.js [email]
 */
require('dotenv').config();
const { prisma } = require('../src/db');
const { loadDashboardWeekPlanContext, buildDashboardPlanMeta } = require('../src/lib/plans/dashboardTodayPlan');

const email = process.argv[2] || 'magdyzeyad54@gmail.com';

async function main() {
  const user = await prisma.user.findFirst({ where: { email }, select: { id: true, email: true } });
  if (!user) {
    console.error('User not found:', email);
    process.exit(1);
  }

  const week = await loadDashboardWeekPlanContext(user.id);
  if (!week) {
    console.error('FAIL no active week plan');
    process.exit(1);
  }

  const meta = buildDashboardPlanMeta(week);
  const trainingDays = (week.workout?.days || []).filter((d) => !d.isRest);
  const maxEx = Math.max(0, ...trainingDays.map((d) => (d.exercises || []).length));
  const dietMeals = (week.diet?.days || []).flatMap((d) => d.meals || []);
  const proteinMeals = dietMeals.filter((m) => (m.protein ?? 0) > 0);

  console.log('OK  weekStart', week.weekStart);
  console.log('OK  trainingDays', trainingDays.length, 'maxExercisesPerDay', maxEx);
  console.log('OK  dietMeals', dietMeals.length, 'withProtein', proteinMeals.length);
  console.log('OK  planMeta', meta);

  if (trainingDays.length < 2) {
    console.error('FAIL expected at least 2 training days in week template');
    process.exit(1);
  }
  if (maxEx < 2) {
    console.error('FAIL expected at least 2 exercises on a training day (production rules plan)');
    process.exit(1);
  }
  if (dietMeals.length < 7) {
    console.error('FAIL expected meals across diet days');
    process.exit(1);
  }
  if (proteinMeals.length < 4) {
    console.error('FAIL expected meal macros (protein > 0) on formatted diet rows');
    process.exit(1);
  }

  console.log('Done. C7 production checks passed for', user.email);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
