/**
 * High-level orchestration for AI plan generation.
 *
 *   1. Load profile + onboarding from Postgres.
 *   2. Compute daily targets (Phase 1).
 *   3. Retrieve safe foods + exercises (Phase 4).
 *   4. Build prompt (Phase 5) and call the LLM.
 *   5. Parse + validate (Phase 3).
 *   6. On first failure → retry with the validation errors fed back to the model.
 *   7. On second failure → save deterministic fallback plan.
 *   8. Save the chosen plan to MongoDB and return it.
 */
const { prisma } = require('../../db');
const { logger } = require('../logger');
const { estimateDailyTargets, maintenanceCalories, bucketGoal } = require('./targets');
const { retrieveFoods } = require('../rag/retrieveFoods');
const { retrieveExercises } = require('../rag/retrieveExercises');
const { retrieveBookChunks } = require('../rag/retrieveBook');
const { buildPlanSystemPrompt, buildPlanUserPrompt } = require('./prompt');
const { validatePlan } = require('./validator');
const { buildFallbackPlan } = require('./fallback');
const { savePlan } = require('./save');
const { completeChat, resolveProvider } = require('../../services/aiChatProvider');

const PLAN_TEMPERATURE = Number(process.env.AI_PLAN_TEMPERATURE || 0.2);
const PLAN_MAX_TOKENS = Number(process.env.AI_PLAN_MAX_TOKENS || 8000);

function extractJson(raw) {
  if (!raw) return null;
  let text = String(raw).trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```\s*$/i, '');
  }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    logger.warn({ err: err.message, preview: text.slice(0, 200) }, 'plan JSON parse failed');
    return null;
  }
}

async function loadInputs(userId) {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) throw new Error('Profile not found for user');
  const onboardingData =
    profile.onboardingData && typeof profile.onboardingData === 'object'
      ? profile.onboardingData
      : {};
  return { profile, onboardingData };
}

async function callLlm({ system, user, temperature, maxTokens }) {
  return completeChat({
    system,
    messages: [{ role: 'user', content: user }],
    temperature,
    maxTokens,
  });
}

/**
 * @param {object} args
 * @param {string} args.userId
 * @param {string} [args.locale='ar']
 * @param {string} [args.regenerationReason]
 * @returns {Promise<{ plan: object, source: 'ai'|'fallback', attempts: number, errors?: string[] }>}
 */
async function generatePlanForUser({ userId, locale = 'ar', regenerationReason = '' } = {}) {
  const t0 = Date.now();
  const { profile, onboardingData } = await loadInputs(userId);

  const targets = estimateDailyTargets(profile, onboardingData);
  const maintenance = maintenanceCalories(profile.weight || 70, bucketGoal(profile.fitnessGoal));

  const [foods, exercises, bookChunks] = await Promise.all([
    retrieveFoods({ onboardingData, targets, limit: 40 }).catch((err) => {
      logger.warn({ err }, 'retrieveFoods failed');
      return [];
    }),
    retrieveExercises({ onboardingData, profile, limit: 50 }).catch((err) => {
      logger.warn({ err }, 'retrieveExercises failed');
      return [];
    }),
    retrieveBookChunks({ onboardingData, profile, message: '', limit: 4 }).catch((err) => {
      logger.warn({ err }, 'retrieveBookChunks failed');
      return [];
    }),
  ]);

  const inputSnapshot = {
    targets,
    foodIds: foods.map((f) => f.id),
    exerciseIds: exercises.map((e) => e.id),
    bookTopics: bookChunks.map((b) => b.topic),
    onboardingKeys: Object.keys(onboardingData),
  };

  if (!resolveProvider()) {
    logger.warn({ userId }, 'No AI provider configured — saving deterministic fallback plan');
    const fallback = buildFallbackPlan({ profile, onboardingData, targets });
    const saved = await savePlan({
      userId,
      planData: fallback,
      source: 'fallback',
      locale,
      regenerationReason: regenerationReason || 'no_ai_provider',
      inputSnapshot,
    });
    return { plan: saved, source: 'fallback', attempts: 0 };
  }

  const system = buildPlanSystemPrompt({ locale });
  const baseUser = buildPlanUserPrompt({
    profile,
    onboardingData,
    targets,
    foods,
    exercises,
    bookChunks,
    regenerationReason,
  });

  let attempts = 0;
  let lastErrors = [];
  let candidate = null;

  for (let i = 0; i < 2; i += 1) {
    attempts += 1;
    const userPrompt =
      i === 0
        ? baseUser
        : buildPlanUserPrompt({
            profile,
            onboardingData,
            targets,
            foods,
            exercises,
            bookChunks,
            regenerationReason,
            validationFeedback: lastErrors.join('\n'),
          });

    let raw;
    try {
      raw = await callLlm({
        system,
        user: userPrompt,
        temperature: PLAN_TEMPERATURE,
        maxTokens: PLAN_MAX_TOKENS,
      });
    } catch (err) {
      logger.error({ err, attempt: attempts }, 'plan LLM call failed');
      lastErrors = [`llm.error: ${err.message}`];
      continue;
    }

    const parsed = extractJson(raw);
    if (!parsed) {
      lastErrors = ['parse: response was not valid JSON. Return only the JSON object.'];
      continue;
    }

    const result = await validatePlan(parsed, {
      profile,
      onboardingData,
      maintenanceCalories: maintenance,
    });

    if (result.ok) {
      candidate = result.plan;
      lastErrors = [];
      break;
    }
    lastErrors = result.errors;
    logger.warn(
      { userId, attempt: attempts, errorCount: result.errors.length, firstError: result.errors[0] },
      'plan validation failed'
    );
  }

  if (candidate) {
    const saved = await savePlan({
      userId,
      planData: candidate,
      source: 'ai',
      locale,
      regenerationReason,
      inputSnapshot,
    });
    logger.info(
      { userId, attempts, ms: Date.now() - t0, version: saved.version },
      'AI plan generated'
    );
    return { plan: saved, source: 'ai', attempts };
  }

  // Both AI attempts failed — fall back to deterministic plan.
  logger.warn({ userId, attempts, errors: lastErrors.slice(0, 3) }, 'falling back to deterministic plan');
  const fallback = buildFallbackPlan({ profile, onboardingData, targets });
  const saved = await savePlan({
    userId,
    planData: fallback,
    source: 'fallback',
    locale,
    regenerationReason: `${regenerationReason || 'fallback'} (ai_validation_failed)`.trim(),
    inputSnapshot: { ...inputSnapshot, lastErrors },
  });
  return { plan: saved, source: 'fallback', attempts, errors: lastErrors };
}

module.exports = {
  generatePlanForUser,
  extractJson,
};
