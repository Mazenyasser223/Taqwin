/**

 * High-level orchestration for AI plan generation (Block C2).

 *

 *   1. Load profile + onboarding from Postgres.

 *   2. Build CAG context bundle + RAG catalogs (foods, exercises, books).

 *   3. Claude via FastAPI derives dailyTargets + full plan from dossier + RAG.

 *   4. validatePlanForPersist — retry with validation feedback.

 *   6. Persist to Postgres (official). On AI failure → PLAN_AI_PENDING (no scaffold saved).

 */

const { prisma } = require('../../db');

const { logger } = require('../logger');

const { buildContextBundle } = require('../contextBundle');

const { estimateDailyTargets, maintenanceCalories, bucketGoal } = require('./targets');

const { ragRetrieve } = require('../rag/ragRetrieve');
const { logAgentTrace } = require('../../services/agentTraceService');

const { validatePlanForPersist } = require('./planValidation');

const { buildFallbackPlan } = require('./fallback');

const {

  enrichPlanExerciseIds,

  enrichPlanExerciseIdsFromDb,

  enrichPlanDietFoodItemsFromDb,

  applyCatalogMacrosToPlan,

  reconcilePlanFoodItemIds,

  sanitizePlanFoodItemIds,

} = require('./planCatalogEnrichment');

const { persistPlanToPostgres } = require('./persistPostgres');

const { syncDailyPlansAfterWeeklyPlan } = require('./dailyAthletePlanService');

const { logPlanGeneration } = require('./planGenerationLog');

const { weekStartIso, resolvePlanWeekStartDate } = require('./planWeek');
const { getOrCreateUserSettings } = require('../userSettings');

const { isFastApiBridgeEnabled, planGenerateViaFastApi } = require('../../services/aiFastApiClient');

const { normalizeClaudePlanShape } = require('./planNormalize');
const { repairPlanProteinCoverage } = require('./planMacroRepair');
const { buildPlanAiPendingError } = require('./planAiPending');

const PLAN_VALIDATION_ATTEMPTS = Math.min(
  5,
  Math.max(1, Number(process.env.PLAN_VALIDATION_ATTEMPTS || 1))
);

const PLAN_BOOK_RAG_LIMIT = Math.min(12, Math.max(4, Number(process.env.PLAN_BOOK_RAG_LIMIT || 4)));

const PLAN_FOOD_RAG_LIMIT = Math.min(60, Math.max(15, Number(process.env.PLAN_FOOD_RAG_LIMIT || 20)));

const PLAN_EXERCISE_RAG_LIMIT = Math.min(80, Math.max(20, Number(process.env.PLAN_EXERCISE_RAG_LIMIT || 25)));



function isPlanRequireAi() {

  const flag = (process.env.FEATURE_PLAN_REQUIRE_AI || 'true').toLowerCase();

  return flag !== 'false' && flag !== '0';

}



function aiExplainability(locale, via = 'claude') {

  const isAr = locale === 'ar';

  if (via === 'claude') {

    return isAr

      ? 'خطة أسبوعية مخصصة بالذكاء الاصطناعي (Claude) — الماكروز والوجبات والتمارين من ملفك + RAG + الكتب التدريبية.'

      : 'Personalized weekly plan from Claude — macros, meals, and workouts from your dossier, RAG catalogs, and coaching books.';

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

  const profile = await prisma.athleteProfile.findUnique({ where: { userId } });

  if (!profile) throw new Error('Profile not found for user');

  const onboardingData =

    profile.onboardingData && typeof profile.onboardingData === 'object'

      ? profile.onboardingData

      : {};

  return { profile, onboardingData };

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



async function enrichPlanForPersist(plan, ctx) {

  let next = plan;

  next = await reconcilePlanFoodItemIds(next, ctx.foods);

  next = applyCatalogMacrosToPlan(next, ctx.foods);

  next = enrichPlanExerciseIds(next, ctx.exercises);

  next = await enrichPlanExerciseIdsFromDb(next);

  next = await enrichPlanDietFoodItemsFromDb(next);

  next = await sanitizePlanFoodItemIds(next);

  next = repairPlanProteinCoverage(next);

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
  if (!isFastApiBridgeEnabled()) {
    return { plan: null, parseError: 'ai_service_not_configured' };
  }

  const fast = await generatePlanJsonViaFastApi(ctx);
  if (fast.plan && fast.fastApiSource === 'ai') {
    return normalizePlanBeforeValidation(fast, ctx);
  }

  logger.warn(
    { userId: ctx.userId, reason: fast.parseError || fast.fastApiSource },
    'FastAPI plan generation did not return valid AI plan'
  );
  return normalizePlanBeforeValidation(fast, ctx);
}



async function _buildProductionRulesPlan(ctx) {

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

  const baseContextBundle = await buildContextBundle(userId, { bypassCache: true });

  const contextBundle = {
    ...baseContextBundle,
    planGenerationHints: {
      mode: 'ai_rag',
      referenceMaintenanceKcal: maintenance,
      referenceFormulaTargets: {
        calories: targets.calorieTarget,
        protein: targets.proteinTarget,
        carbs: targets.carbTarget,
        fat: targets.fatTarget,
        waterMl: targets.waterMl ?? 2500,
      },
      referenceWorkoutHints: {
        trainingDaysPerWeek: onboardingData.trainingDaysPerWeek ?? null,
        preferredSplit: onboardingData.preferredSplit ?? null,
        workoutLocation: onboardingData.workoutLocation ?? null,
        workoutDuration: onboardingData.workoutDuration ?? null,
        equipment: onboardingData.equipment ?? null,
        injuries: onboardingData.injuries ?? null,
        fitnessLevel: onboardingData.fitnessLevel ?? profile.fitnessLevel ?? null,
      },
    },
  };



  const planTraceId = `plan-rag-${userId}-${Date.now()}`;

  const [foodResult, exerciseResult, bookResult] = await Promise.all([
    ragRetrieve({
      purpose: 'plan_catalog',
      kind: 'food',
      onboardingData,
      profile,
      limit: PLAN_FOOD_RAG_LIMIT,
      traceId: planTraceId,
    }).catch((err) => {
      logger.warn({ err }, 'ragRetrieve food failed');
      return {
        items: [],
        trace: {
          purpose: 'plan_catalog',
          kind: 'food',
          path: 'error',
          fallback: err.message,
          hitCount: 0,
        },
      };
    }),
    ragRetrieve({
      purpose: 'plan_catalog',
      kind: 'exercise',
      onboardingData,
      profile,
      limit: PLAN_EXERCISE_RAG_LIMIT,
      traceId: planTraceId,
    }).catch((err) => {
      logger.warn({ err }, 'ragRetrieve exercise failed');
      return {
        items: [],
        trace: {
          purpose: 'plan_catalog',
          kind: 'exercise',
          path: 'error',
          fallback: err.message,
          hitCount: 0,
        },
      };
    }),
    ragRetrieve({
      purpose: 'plan_catalog',
      kind: 'book',
      onboardingData,
      profile,
      limit: PLAN_BOOK_RAG_LIMIT,
      traceId: planTraceId,
    }).catch((err) => {
      logger.warn({ err }, 'ragRetrieve book failed');
      return {
        items: [],
        trace: {
          purpose: 'plan_catalog',
          kind: 'book',
          path: 'error',
          fallback: err.message,
          hitCount: 0,
        },
      };
    }),
  ]);

  const foods = foodResult.items;

  const exercises = exerciseResult.items;

  const bookChunks = bookResult.items;

  const ragTraces = {

    food: foodResult.trace,

    exercise: exerciseResult.trace,

    book: bookResult.trace,

  };

  logger.info({ userId, ragTraces, traceId: planTraceId }, 'plan RAG retrieval traces');
  void logAgentTrace({
    userId,
    intent: 'plan_generate_rag',
    nodes: [{ type: 'rag', traceId: planTraceId, traces: ragTraces }],
    success: true,
  }).catch(() => null);



  const inputSnapshot = {

    targets,

    foodIds: foods.map((f) => f.id),

    exerciseIds: exercises.map((e) => e.id),

    bookTopics: bookChunks.map((b) => b.topic),

    onboardingKeys: Object.keys(onboardingData),

    viaFastApi: isFastApiBridgeEnabled(),

    requireAi: isPlanRequireAi(),

    cagKeys: Object.keys(contextBundle || {}),

    ragTraces,

  };



  const canGenerate = isFastApiBridgeEnabled();

  if (!canGenerate) {
    logger.warn({ userId }, 'Plan AI bridge unavailable');
    throw buildPlanAiPendingError({ locale, reason: 'ai_bridge_unavailable' });
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



  logger.warn({ userId, attempts, errors: lastErrors.slice(0, 3) }, 'Claude plan failed — athlete pending contact');
  throw buildPlanAiPendingError({
    locale,
    reason: lastErrors.slice(0, 3).join('; '),
  });
}



module.exports = {

  generatePlanForUser,

  extractJson,

  saveGeneratedPlan,

  isPlanRequireAi,

  aiExplainability,

};


