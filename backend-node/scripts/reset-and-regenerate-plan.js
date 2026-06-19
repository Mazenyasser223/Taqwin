/* eslint-disable no-console */
/**
 * Delete all Postgres plans for a user, then generate a fresh Claude plan.
 *
 *   node scripts/reset-and-regenerate-plan.js mazenyasser223@gmail.com
 *   node scripts/reset-and-regenerate-plan.js mazenyasser223@gmail.com --keep-logs
 *   node scripts/reset-and-regenerate-plan.js mazenyasser223@gmail.com --locale=en
 */
require('dotenv').config({ override: true });

const { prisma } = require('../src/db');
const { generatePlanForUser } = require('../src/lib/plans/generator');

function parseLocale(argv) {
  const flag = argv.find((a) => a.startsWith('--locale='));
  if (flag) return flag.split('=')[1].trim().toLowerCase() === 'en' ? 'en' : 'ar';
  const env = String(process.env.PLAN_CATALOG_LOCALE || 'en').toLowerCase();
  return env === 'en' ? 'en' : 'ar';
}

function isTransientDbError(err) {
  const msg = String(err?.message || err || '');
  return /Can't reach database server|ECONNREFUSED|ETIMEDOUT|connection terminated|P1001|P1017/i.test(msg);
}

async function withDbRetry(label, fn, { attempts = 5, delayMs = 2500 } = {}) {
  let lastErr;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientDbError(err) || i === attempts) throw err;
      console.warn(`[db] ${label} failed (attempt ${i}/${attempts}) — retrying in ${delayMs}ms…`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

async function deleteUserPlans(userId) {
  const [daily, workout, diet, feedback, changes] = await Promise.all([
    prisma.dailyAthletePlan.deleteMany({ where: { userId } }),
    prisma.workoutPlan.deleteMany({ where: { userId } }),
    prisma.dietPlan.deleteMany({ where: { userId } }),
    prisma.planFeedback.deleteMany({ where: { userId } }),
    prisma.planChangeLog.deleteMany({ where: { userId } }),
  ]);
  return { daily, workout, diet, feedback, changes };
}

async function main() {
  const rawArgv = process.argv.slice(2);
  const argv = rawArgv.filter((a) => !a.startsWith('--'));
  const keepLogs = rawArgv.includes('--keep-logs');
  const locale = parseLocale(rawArgv);
  const email = (argv[0] || '').trim().toLowerCase();
  if (!email) {
    console.error('Usage: node scripts/reset-and-regenerate-plan.js <email> [--keep-logs] [--locale=en|ar]');
    process.exit(1);
  }

  const user = await withDbRetry('user lookup', () => prisma.user.findFirst({ where: { email } }));
  if (!user) {
    console.error('User not found:', email);
    process.exit(1);
  }

  console.log('Deleting plans for', email, `(${user.id})`);
  const deleted = await deleteUserPlans(user.id);
  console.log('Deleted:', {
    dailyAthletePlans: deleted.daily.count,
    workoutPlans: deleted.workout.count,
    dietPlans: deleted.diet.count,
    planFeedbacks: deleted.feedback.count,
    planChangeLogs: deleted.changes.count,
  });

  if (!keepLogs) {
    const [foodLogs, exerciseLogs, workoutLogs] = await Promise.all([
      prisma.foodLog.deleteMany({ where: { userId: user.id } }),
      prisma.exerciseLog.deleteMany({ where: { userId: user.id } }),
      prisma.workoutLog.deleteMany({ where: { userId: user.id } }),
    ]);
    console.log('Cleared logs:', {
      foodLogs: foodLogs.count,
      exerciseLogs: exerciseLogs.count,
      workoutLogs: workoutLogs.count,
    });
  }

  console.log('Generating fresh Claude plan…', { locale });
  const result = await withDbRetry('plan generation', () =>
    generatePlanForUser({
      userId: user.id,
      locale,
      regenerationReason: 'first_plan',
    }),
  );

  console.log('OK', {
    source: result.source,
    attempts: result.attempts,
    storage: result.storage,
    version: result.plan?.version,
    explainability: result.plan?.explainabilityText?.slice(0, 120),
  });
}

main()
  .catch((err) => {
    console.error('FAIL', err.message);
    if (err.validationErrors) console.error(err.validationErrors.slice(0, 5));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
