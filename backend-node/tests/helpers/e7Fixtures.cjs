/**
 * Shared E7 fixtures — used by verify-e7 and Vitest DB tests.
 */
const jwt = require('jsonwebtoken');

const TEST_EMAIL = 'ci-e7-confirm@taqwin.test';
const TEST_EMAIL_OTHER = 'ci-e7-other@taqwin.test';
const TEST_FOOD_NAME = 'CI E7 Chicken Breast';
const TEST_FOOD_ALT_NAME = 'CI E7 Chicken Thigh';

function configureConfirmEnv() {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-ci';
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
  process.env.FEATURE_AI_VIA_FASTAPI = 'false';
  process.env.FEATURE_REALTIME_WS = process.env.FEATURE_REALTIME_WS || 'true';
  process.env.AI_INTERNAL_KEY = process.env.AI_INTERNAL_KEY || 'test-internal-key-min-16-chars';
  delete process.env.AI_SERVICE_URL;
}

function configureChatEnv(aiServiceUrl) {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-ci';
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
  process.env.FEATURE_AI_VIA_FASTAPI = 'true';
  process.env.AI_SERVICE_URL = aiServiceUrl || process.env.AI_SERVICE_URL || 'http://127.0.0.1:8765';
  process.env.AI_INTERNAL_KEY = process.env.AI_INTERNAL_KEY || 'test-internal-key-min-16-chars';
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });
}

async function ensureFixtures(prisma) {
  async function upsertUser(email) {
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          role: 'athlete',
          emailVerifiedAt: new Date(),
        },
      });
    }
    return user;
  }

  const user = await upsertUser(TEST_EMAIL);
  const otherUser = await upsertUser(TEST_EMAIL_OTHER);

  for (const u of [user, otherUser]) {
    const profile = await prisma.athleteProfile.findUnique({ where: { userId: u.id } });
    if (!profile) {
      await prisma.athleteProfile.create({
        data: {
          userId: u.id,
          displayName: u.id === user.id ? 'CI E7 Athlete' : 'CI E7 Other',
          fitnessGoal: 'Maintenance',
          fitnessLevel: 'Intermediate',
          height: 175,
          weight: 75,
        },
      });
    }
  }

  async function ensureFood(name, macros) {
    let food = await prisma.foodItem.findFirst({ where: { name } });
    if (!food) {
      food = await prisma.foodItem.create({
        data: { name, category: 'Protein', ...macros },
      });
    }
    return food;
  }

  const food = await ensureFood(TEST_FOOD_NAME, {
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
  });
  const foodAlt = await ensureFood(TEST_FOOD_ALT_NAME, {
    calories: 209,
    protein: 26,
    carbs: 0,
    fat: 11,
  });

  return { user, otherUser, food, foodAlt };
}

async function countFoodLogs(prisma, userId, foodItemId, grams) {
  return prisma.foodLog.count({ where: { userId, foodItemId, grams } });
}

function fastApiFoodLogStub(food, grams, preview) {
  return {
    reply: `I'll log ${grams}g ${food.name} for you.`,
    toolCalls: [
      {
        name: 'log_food',
        input: { foodItemId: food.id, foodName: food.name, grams },
      },
    ],
    confirmationRequired: true,
    confirmationPreview: preview || `Log food: ${food.name} (${grams}g)`,
    intent: 'execute_action',
    sourceUserMessage: `log ${grams}g ${food.name}`,
  };
}

module.exports = {
  TEST_EMAIL,
  TEST_EMAIL_OTHER,
  TEST_FOOD_NAME,
  TEST_FOOD_ALT_NAME,
  configureConfirmEnv,
  configureChatEnv,
  signToken,
  ensureFixtures,
  countFoodLogs,
  fastApiFoodLogStub,
};
