/**

 * High-level orchestration for AI plan generation (Block C2).

 *

 *   1. Load profile + onboarding from Postgres.

 *   2. Compute daily targets + CAG context bundle.

 *   3. RAG: foods, exercises, book chunks (Mongo/pgvector).

 *   4. Claude via FastAPI (preferred) or in-process Anthropic.

 *   5. validatePlanForPersist — retry with validation feedback.

 *   6. Persist to Postgres (official). Rules fallback only if FEATURE_PLAN_REQUIRE_AI=false.

 */

const { prisma } = require('../../db');

const { logger } = require('../logger');

const { buildContextBundle, formatContextBundleForPlan } = require('../contextBundle');

const { estimateDailyTargets, maintenanceCalories, bucketGoal } = require('./targets');

const { retrieveFoods } = require('../rag/retrieveFoods');

const { retrieveExercises } = require('../rag/retrieveExercises');

const { retrieveBookChunks } = require('../rag/retrieveBook');

const { buildPlanSystemPrompt, buildPlanUserPrompt } = require('./prompt');

const { validatePlanForPersist } = require('./planValidation');

const { buildFallbackPlan } = require('./fallback');

const {

  enrichPlanExerciseIds,

  enrichPlanExerciseIdsFromDb,

  enrichPlanDietFoodItemsFromDb,

} = require('./planCatalogEnrichment');

const { persistPlanToPostgres } = require('./persistPostgres');

const { syncDailyPlansAfterWeeklyPlan } = require('./dailyAthletePlanService');

const { logPlanGeneration } = require('./planGenerationLog');

const { weekStartIso, weekStartSundayUtc, resolvePlanWeekStartDate } = require('./planWeek');
const { getOrCreateUserSettings } = require('../userSettings');

const { completeChat, resolveProvider } = require('../../services/aiChatProvider');

const { isFastApiBridgeEnabled, planGenerateViaFastApi } = require('../../services/aiFastApiClient');

const { normalizeClaudePlanShape } = require('./planNormalize');

const PLAN_TEMPERATURE = Number(process.env.AI_PLAN_TEMPERATURE || 0.2);

const PLAN_MAX_TOKENS = Number(process.env.AI_PLAN_MAX_TOKENS || 12000);

const PLAN_VALIDATION_ATTEMPTS = Math.min(

  5,

  Math.max(2, Number(process.env.PLAN_VALIDATION_ATTEMPTS || 3))

);

const PLAN_BOOK_RAG_LIMIT = Math.min(12, Math.max(4, Number(process.env.PLAN_BOOK_RAG_LIMIT || 8)));

const PLAN_FOOD_RAG_LIMIT = Math.min(60, Math.max(20, Number(process.env.PLAN_FOOD_RAG_LIMIT || 50)));

const PLAN_EXERCISE_RAG_LIMIT = Math.min(80, Math.max(25, Number(process.env.PLAN_EXERCISE_RAG_LIMIT || 60)));



function isPlanRequireAi() {

  const flag = (process.env.FEATURE_PLAN_REQUIRE_AI || 'true').toLowerCase();

  return flag !== 'false' && flag !== '0';

}



function aiExplainability(locale, via = 'claude') {

  const isAr = locale === 'ar';

  if (via === 'claude') {

    return isAr

      ? 'خطة أسبوعية مخصصة بالذكاء الاصطناعي (Claude) من ملفك، RAG، والكتب التدريبية.'

      : 'Personalized weekly plan from Claude using your profile, RAG catalogs, and coaching books.';

  }

  return isAr

    ? 'خطة مخصصة من الذكاء الاصطناعي بناءً على ملفك وقواعد الأمان.'

    : 'AI-personalized plan from your profile and safety rules.';

}



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

    const repaired = text.replace(/,\s*([}\]])/g, '$1');

    try {

      return JSON.parse(repaired);

    } catch {

      logger.warn({ err: err.message, preview: text.slice(0, 200) }, 'plan JSON parse failed');

      return null;

    }

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

 * @param {{

 *   userId: string,

 *   profile: object,

 *   onboardingData: object,

 *   targets: object,

 *   foods: object[],

 *   exercises: object[],

 *   bookChunks: object[],

 *   contextBundle: object,

 *   locale: string,

 *   regenerationReason: string,

 *   validationFeedback: string,

 * }} ctx

 */

async function generatePlanJsonViaFastApi(ctx) {

  const bundle = ctx.contextBundle || (await buildContextBundle(ctx.userId));

  const weekStart = weekStartIso();

  try {

    const result = await planGenerateViaFastApi({

      userId: ctx.userId,

      contextBundle: bundle,

      weekStart,

      foods: ctx.foods?.length ? ctx.foods : null,

      exercises: ctx.exercises?.length ? ctx.exercises : null,

      bookChunks: ctx.bookChunks?.length ? ctx.bookChunks : null,

      regenerationReason: ctx.regenerationReason,

      validationFeedback: ctx.validationFeedback,

    });



    if (result?.source === 'scaffold') {

      return {

        plan: null,

        fastApiSource: 'scaffold',

        parseError: 'FastAPI returned scaffold — Claude did not produce valid plan JSON',

        explainabilityText: result.explainabilityText || '',

      };

    }



    if (result?.plan && typeof result.plan === 'object') {

      return {

        plan: result.plan,

        fastApiSource: result.source === 'ai' ? 'ai' : 'ai',

        explainabilityText: result.explainabilityText || aiExplainability(ctx.locale, 'claude'),

      };

    }

    return { plan: null, parseError: 'FastAPI returned empty plan' };

  } catch (err) {

    logger.warn({ err: err.message, userId: ctx.userId }, 'FastAPI plan generate failed');

    return { plan: null, parseError: err.message };

  }

}



async function generatePlanJsonViaLocalLlm(ctx) {

  if (!resolveProvider()) return { plan: null, parseError: 'no_ai_provider' };



  const bundle = ctx.contextBundle || (await buildContextBundle(ctx.userId));

  const cagBlock = formatContextBundleForPlan(bundle);



  const system = buildPlanSystemPrompt({ locale: ctx.locale });

  const user = buildPlanUserPrompt({

    profile: ctx.profile,

    onboardingData: ctx.onboardingData,

    targets: ctx.targets,

    foods: ctx.foods,

    exercises: ctx.exercises,

    bookChunks: ctx.bookChunks,

    contextBundleText: cagBlock,

    regenerationReason: ctx.regenerationReason,

    validationFeedback: ctx.validationFeedback,

  });



  try {

    const raw = await callLlm({

      system,

      user,

      temperature: PLAN_TEMPERATURE,

      maxTokens: PLAN_MAX_TOKENS,

    });

    const parsed = normalizeClaudePlanShape(extractJson(raw));

    if (!parsed) return { plan: null, parseError: 'invalid JSON from local LLM' };

    return {

      plan: parsed,

      fastApiSource: 'ai',

      explainabilityText: aiExplainability(ctx.locale, 'claude'),

    };

  } catch (err) {

    return { plan: null, parseError: err.message };

  }

}



async function enrichPlanForPersist(plan, ctx) {

  let next = plan;

  next = enrichPlanExerciseIds(next, ctx.exercises);

  next = await enrichPlanExerciseIdsFromDb(next);

  next = await enrichPlanDietFoodItemsFromDb(next);

  return next;

}



async function normalizePlanBeforeValidation(gen, ctx) {

  if (!gen.plan) return gen;

  const shaped = normalizeClaudePlanShape(gen.plan);

  return {

    ...gen,

    plan: await enrichPlanForPersist(shaped, ctx),

  };

}



async function generatePlanJsonAttempt(ctx) {

  if (isFastApiBridgeEnabled()) {

    const fast = await generatePlanJsonViaFastApi(ctx);

    if (fast.plan && fast.fastApiSource === 'ai') {

      return normalizePlanBeforeValidation(fast, ctx);

    }

    logger.info(

      { userId: ctx.userId, reason: fast.parseError || fast.fastApiSource },

      'FastAPI plan not from Claude — trying in-process LLM'

    );

  }

  const local = await generatePlanJsonViaLocalLlm(ctx);

  return normalizePlanBeforeValidation(local, ctx);

}



async function buildProductionRulesPlan(ctx) {

  let plan = buildFallbackPlan({

    profile: ctx.profile,

    onboardingData: ctx.onboardingData,

    targets: ctx.targets,

  });

  plan = enrichPlanExerciseIds(plan, ctx.exercises);

  plan = await enrichPlanExerciseIdsFromDb(plan);

  plan = await enrichPlanDietFoodItemsFromDb(plan);

  return plan;

}



/**

 * @param {{

 *   userId: string,

 *   planData: object,

 *   legacySource: 'ai'|'fallback',

 *   locale: string,

 *   regenerationReason?: string,

 *   explainabilityText?: string,

 *   inputSnapshot?: object,

 *   fastApiSource?: string,

 * }} args

 */

async function saveGeneratedPlan({

  userId,

  planData,

  legacySource,

  locale,

  regenerationReason = '',

  explainabilityText = '',

  inputSnapshot = {},

  fastApiSource = '',

}) {

  const settings = await getOrCreateUserSettings(userId);
  const weekStart = resolvePlanWeekStartDate({
    regenerationReason,
    timezone: settings?.timezone || 'UTC',
  });

  const saved = await persistPlanToPostgres({

    userId,

    planData,

    legacySource,

    locale,

    regenerationReason,

    explainabilityText,

    weekStart,

  });



  await logPlanGeneration({

    userId,

    weekStart: weekStartIso(),

    rawPlan: planData,

    validationResult: 'accepted',

    validationErrors: [],

    source: legacySource,

    fastApiSource,

    inputSnapshot,

  });



  const dailySlice = await syncDailyPlansAfterWeeklyPlan(userId, { days: 7 });

  if (dailySlice.ok) {

    saved.dailyAthletePlans = { created: dailySlice.created, total: dailySlice.total };

  }



  return saved;

}



/**

 * @param {object} args

 * @param {string} args.userId

 * @param {string} [args.locale='ar']

 * @param {string} [args.regenerationReason]

 */

async function generatePlanForUser({ userId, locale = 'ar', regenerationReason = '' } = {}) {

  const t0 = Date.now();

  const { profile, onboardingData } = await loadInputs(userId);



  const targets = estimateDailyTargets(profile, onboardingData);

  const maintenance = maintenanceCalories(profile.weight || 70, bucketGoal(profile.fitnessGoal));



  const contextBundle = await buildContextBundle(userId, { bypassCache: true });



  const [foods, exercises, bookChunks] = await Promise.all([

    retrieveFoods({ onboardingData, targets, limit: PLAN_FOOD_RAG_LIMIT }).catch((err) => {

      logger.warn({ err }, 'retrieveFoods failed');

      return [];

    }),

    retrieveExercises({ onboardingData, profile, limit: PLAN_EXERCISE_RAG_LIMIT }).catch((err) => {

      logger.warn({ err }, 'retrieveExercises failed');

      return [];

    }),

    retrieveBookChunks({ onboardingData, profile, message: '', limit: PLAN_BOOK_RAG_LIMIT }).catch(

      (err) => {

        logger.warn({ err }, 'retrieveBookChunks failed');

        return [];

      }

    ),

  ]);



  const inputSnapshot = {

    targets,

    foodIds: foods.map((f) => f.id),

    exerciseIds: exercises.map((e) => e.id),

    bookTopics: bookChunks.map((b) => b.topic),

    onboardingKeys: Object.keys(onboardingData),

    viaFastApi: isFastApiBridgeEnabled(),

    requireAi: isPlanRequireAi(),

    cagKeys: Object.keys(contextBundle || {}),

  };



  const canGenerate = isFastApiBridgeEnabled() || Boolean(resolveProvider());



  if (!canGenerate) {

    const msg =

      'Plan AI unavailable: set ANTHROPIC_API_KEY (backend-node + ai-service), AI_SERVICE_URL, FEATURE_AI_VIA_FASTAPI=true';

    if (isPlanRequireAi()) {

      throw new Error(msg);

    }

    logger.warn({ userId }, 'No AI provider — rules fallback (FEATURE_PLAN_REQUIRE_AI=false)');

    const fallback = await buildProductionRulesPlan({

      userId,

      profile,

      onboardingData,

      targets,

      exercises,

      foods,

      bookChunks,

      locale,

    });

    const saved = await saveGeneratedPlan({

      userId,

      planData: fallback,

      legacySource: 'fallback',

      locale,

      regenerationReason: regenerationReason || 'no_ai_provider',

      inputSnapshot,

    });

    return { plan: saved, source: 'fallback', attempts: 0, storage: 'postgres' };

  }



  let attempts = 0;

  let lastErrors = [];

  let candidate = null;

  let explainabilityText = aiExplainability(locale, 'claude');

  let fastApiSource = '';



  for (let i = 0; i < PLAN_VALIDATION_ATTEMPTS; i += 1) {

    attempts += 1;

    const gen = await generatePlanJsonAttempt({

      userId,

      profile,

      onboardingData,

      targets,

      foods,

      exercises,

      bookChunks,

      contextBundle,

      locale,

      regenerationReason,

      validationFeedback: i === 0 ? '' : lastErrors.join('\n'),

    });



    if (!gen.plan) {

      lastErrors = [gen.parseError || 'generation failed'];

      continue;

    }



    if (gen.explainabilityText) explainabilityText = gen.explainabilityText;

    if (gen.fastApiSource) fastApiSource = gen.fastApiSource;



    const result = await validatePlanForPersist(gen.plan, {

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

    await logPlanGeneration({

      userId,

      weekStart: weekStartIso(),

      rawPlan: gen.plan,

      validationResult: 'rejected',

      validationErrors: result.errors,

      source: 'ai',

      fastApiSource: gen.fastApiSource || '',

      inputSnapshot,

    });

    logger.warn(

      { userId, attempt: attempts, errorCount: result.errors.length, firstError: result.errors[0] },

      'plan validation failed'

    );

  }



  if (candidate) {

    const saved = await saveGeneratedPlan({

      userId,

      planData: candidate,

      legacySource: 'ai',

      locale,

      regenerationReason,

      explainabilityText,

      inputSnapshot,

      fastApiSource: fastApiSource || 'ai',

    });

    logger.info(

      { userId, attempts, ms: Date.now() - t0, version: saved.version, storage: 'postgres' },

      'Claude plan generated and persisted'

    );

    return { plan: saved, source: 'ai', attempts, storage: 'postgres' };

  }



  if (isPlanRequireAi()) {

    const err = new Error(

      `Claude plan generation failed after ${attempts} attempt(s): ${lastErrors.slice(0, 3).join('; ')}`

    );

    err.code = 'PLAN_AI_FAILED';

    err.validationErrors = lastErrors;

    throw err;

  }



  logger.warn({ userId, attempts, errors: lastErrors.slice(0, 3) }, 'Claude failed — rules fallback');

  const fallback = await buildProductionRulesPlan({

    userId,

    profile,

    onboardingData,

    targets,

    exercises,

    foods,

    bookChunks,

    locale,

  });

  const saved = await saveGeneratedPlan({

    userId,

    planData: fallback,

    legacySource: 'fallback',

    locale,

    regenerationReason: `${regenerationReason || 'fallback'} (ai_validation_failed)`.trim(),

    explainabilityText,

    inputSnapshot: { ...inputSnapshot, lastErrors },

    fastApiSource,

  });

  return { plan: saved, source: 'fallback', attempts, errors: lastErrors, storage: 'postgres' };

}



module.exports = {

  generatePlanForUser,

  extractJson,

  saveGeneratedPlan,

  isPlanRequireAi,

  aiExplainability,

};


