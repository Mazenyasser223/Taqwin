/* eslint-disable no-console */
/**
 * Block A5 verification — CAG context bundle + Redis cache.
 *
 *   npm run verify:a5
 *   npm run verify:a5 -- --user-id=YOUR_UUID
 *   npm run verify:a5 -- --user-id=YOUR_UUID --json
 *   npm run verify:a5 -- --user-id=YOUR_UUID --invalidate
 */
require('dotenv').config();
const { prisma } = require('../src/db');
const { isRedisEnabled, isRedisReady, connectRedis, redisGetJson } = require('../src/lib/redis');
const {
  buildContextBundle,
  buildContextBundleFresh,
  invalidateContextBundle,
  cagCacheKey,
} = require('../src/lib/contextBundle');

function argValue(name) {
  const pref = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (pref) return pref.slice(name.length + 3);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1];
  }
  return null;
}

function summarizeBundle(bundle) {
  return {
    locale: bundle.locale,
    timezone: bundle.timezone,
    generatedAt: bundle.generatedAt,
    profile: bundle.profile
      ? {
          displayName: bundle.profile.displayName,
          weightKg: bundle.profile.weightKg,
          fitnessGoal: bundle.profile.fitnessGoal,
        }
      : null,
    nutritionToday: {
      date: bundle.nutritionToday?.date,
      mealsLogged: bundle.nutritionToday?.logged?.mealCount,
      caloriesLogged: bundle.nutritionToday?.logged?.calories,
      calorieTarget: bundle.nutritionToday?.targets?.calories,
    },
    hasWorkoutToday: Boolean(bundle.workoutToday),
    hasWeekPlan: Boolean(bundle.weekPlanSummary),
    onboardingCoreKeys: Object.keys(bundle.onboardingByFlow?.core || {}),
    onboardingBodyType:
      bundle.onboardingByFlow?.core?.bodyType || bundle.onboardingSummary?.bodyType || null,
    aiMemoryCount: bundle.aiMemories?.length ?? 0,
    constraints: bundle.constraints,
  };
}

async function main() {
  const userId =
    argValue('user-id') ||
    process.env.A5_VERIFY_USER_ID ||
    process.argv[2]?.match(/^[0-9a-f-]{36}$/i)?.[0];

  if (!userId) {
    console.error('Usage: npm run verify:a5 -- --user-id=YOUR_USER_UUID');
    console.error('   or: set A5_VERIFY_USER_ID in .env');
    process.exit(1);
  }

  const printJson = process.argv.includes('--json');
  const doInvalidate = process.argv.includes('--invalidate');

  console.log('Block A5 — CAG context bundle verification\n');
  console.log('User ID:', userId);
  console.log('Redis configured:', isRedisEnabled());
  console.log('');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!user) {
    console.error('FAIL: User not found in Postgres. Use a real athlete user id.');
    process.exit(1);
  }
  console.log('User found:', user.email || user.id);

  if (isRedisEnabled()) {
    await connectRedis();
    console.log('Redis ready:', isRedisReady());
  }

  if (doInvalidate) {
    const ok = await invalidateContextBundle(userId);
    console.log('\ninvalidateContextBundle →', ok ? 'deleted cache key' : 'no Redis / key missing');
  }

  console.log('\n1) buildContextBundleFresh (always from DB)...');
  const t0 = Date.now();
  const fresh = await buildContextBundleFresh(userId);
  console.log(`   done in ${Date.now() - t0}ms`);
  if (printJson) {
    console.log(JSON.stringify(fresh, null, 2));
  } else {
    console.log('   summary:', JSON.stringify(summarizeBundle(fresh), null, 2));
  }

  const requiredKeys = [
    'profile',
    'onboardingSummary',
    'onboardingByFlow',
    'nutritionToday',
    'nutritionWeek',
    'workoutToday',
    'weekPlanSummary',
    'constraints',
    'locale',
    'timezone',
    'generatedAt',
  ];
  for (const key of requiredKeys) {
    if (!(key in fresh)) {
      console.error(`FAIL: missing bundle key "${key}"`);
      process.exit(1);
    }
  }

  console.log('\n2) buildContextBundle (cache path)...');
  await invalidateContextBundle(userId);
  const first = await buildContextBundle(userId);
  const second = await buildContextBundle(userId);

  if (first.generatedAt !== second.generatedAt) {
    console.warn('   WARN: second call rebuilt bundle (cache may be off or TTL=0)');
  } else {
    console.log('   OK: second call reused cached bundle (same generatedAt)');
  }

  if (isRedisReady()) {
    const cached = await redisGetJson(cagCacheKey(userId));
    console.log('   Redis key:', `taqwin:${cagCacheKey(userId)}`, cached ? 'present' : 'missing');
  }

  console.log('\n3) invalidateContextBundle...');
  const invalidated = await invalidateContextBundle(userId);
  console.log('   result:', invalidated);

  console.log('\nBlock A5 verification passed.');
  console.log('\nNext — test chat with FastAPI bridge:');
  console.log('  1. ai-service: uvicorn app.main:app --port 8000');
  console.log('  2. backend .env: FEATURE_AI_VIA_FASTAPI=true, AI_SERVICE_URL=http://localhost:8000');
  console.log('  3. POST /api/ai/chat with JWT — stub reply includes CAG summary when bundle is sent');
}

main()
  .catch((err) => {
    console.error('FAIL:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
  });
