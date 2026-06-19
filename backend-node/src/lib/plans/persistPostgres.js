/**
 * Block C2 — persist validated plan JSON to Postgres (official source of truth).
 */
const { prisma } = require('../../db');
const { logger } = require('../logger');
const { weekStartSundayUtc } = require('./planWeek');
const {
  inferIsRestWorkoutDay,
  resolveExercisesForPersist,
  defaultExerciseRowForFocus,
} = require('./planWorkoutDay');
const { mealItemMacrosFromFoodRow } = require('./planDietMacros');
const { inferLegacySource, isBoilerplateCoachNotes } = require('./planLegacySource');

/** @typedef {'onboarding'|'weekly_cron'|'adaptation'|'manual'} PlanSourceEnum */

/**
 * @param {string} legacySource - 'ai' | 'fallback' from generator
 * @param {string} [regenerationReason]
 * @returns {PlanSourceEnum}
 */
function mapLegacySourceToPrisma(legacySource, regenerationReason = '') {
  if (legacySource === 'fallback') return 'manual';
  if (legacySource === 'ai') {
    const reason = String(regenerationReason || '').trim();
    if (reason && !/^onboarding/i.test(reason)) return 'manual';
    return 'onboarding';
  }
  return 'onboarding';
}

/**
 * Build Mongo-shaped plan for dashboard / coach (read compatibility).
 */
function toLegacyPlanDocument({
  userId,
  workoutPlan,
  dietPlan,
  planData,
  legacySource,
  locale,
  version,
}) {
  const dt = planData.dailyTargets || {};
  const dietDays = (planData.dietDays || []).map((day) => ({
    dayIndex: day.dayIndex,
    label: day.label || '',
    meals: (day.meals || []).map((meal) => ({
      slot: meal.slot,
      items: (meal.items || []).map((item) => ({
        foodItemId: item.foodItemId ?? null,
        webtebId: item.webtebId ?? null,
        name: item.name,
        grams: item.grams,
        calories: item.calories ?? 0,
        protein: item.protein ?? 0,
        carbs: item.carbs ?? 0,
        fat: item.fat ?? 0,
        notes: item.notes || '',
      })),
    })),
  }));

  const workoutWeeks = (planData.workoutWeeks || []).map((week) => ({
    weekIndex: week.weekIndex,
    days: (week.days || []).map((d) => ({
      dayIndex: d.dayIndex,
      type: d.type || (d.isRest ? 'rest' : 'full'),
      label: d.label || '',
      isRest: Boolean(d.isRest),
      exercises: (d.exercises || []).map((e) => ({
        exerciseId: e.exerciseId ?? null,
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        restSec: e.restSec ?? 90,
        notes: e.notes || '',
      })),
    })),
  }));

  const id = workoutPlan?.id || dietPlan?.id || userId;
  const createdAt = workoutPlan?.createdAt || dietPlan?.createdAt || new Date();

  return {
    _id: id,
    userId,
    version: version ?? 1,
    isActive: true,
    source: legacySource,
    locale: locale || 'ar',
    coachNotes: planData.coachNotes || '',
    regenerationReason: planData.regenerationReason || '',
    explainabilityText:
      workoutPlan?.explainabilityText || dietPlan?.explainabilityText || planData.coachNotes || '',
    dailyTargets: {
      calories: dt.calories,
      protein: dt.protein,
      carbs: dt.carbs,
      fat: dt.fat,
      waterMl: dt.waterMl,
    },
    dietDays,
    workoutWeeks,
    createdAt,
    updatedAt: workoutPlan?.updatedAt || dietPlan?.updatedAt || createdAt,
    postgres: {
      workoutPlanId: workoutPlan?.id ?? null,
      dietPlanId: dietPlan?.id ?? null,
      weekStart: workoutPlan?.weekStart || dietPlan?.weekStart || null,
    },
  };
}

/**
 * @param {{
 *   userId: string,
 *   planData: object,
 *   legacySource: 'ai'|'fallback',
 *   locale?: string,
 *   regenerationReason?: string,
 *   explainabilityText?: string,
 *   prismaSource?: PlanSourceEnum,
 *   weekStart?: Date,
 * }} args
 */
async function persistPlanToPostgres({
  userId,
  planData,
  legacySource,
  locale = 'ar',
  regenerationReason = '',
  explainabilityText = '',
  prismaSource,
  weekStart,
} = {}) {
  if (!userId) throw new Error('persistPlanToPostgres: userId required');
  if (!planData?.dailyTargets) throw new Error('persistPlanToPostgres: planData.dailyTargets required');

  const ws = weekStart || weekStartSundayUtc();
  const source = prismaSource || mapLegacySourceToPrisma(legacySource, regenerationReason);
  const explain =
    String(explainabilityText || '').trim() || String(planData.coachNotes || '').slice(0, 500);
  const dt = planData.dailyTargets;

  const previousCount = await prisma.workoutPlan.count({ where: { userId } });
  const version = previousCount + 1;

  const txTimeoutMs = Number(process.env.PLAN_PERSIST_TX_TIMEOUT_MS || 30_000);

  const result = await prisma.$transaction(
    async (tx) => {
    await tx.workoutPlan.updateMany({
      where: { userId, status: 'active' },
      data: { status: 'superseded' },
    });
    await tx.dietPlan.updateMany({
      where: { userId, status: 'active' },
      data: { status: 'superseded' },
    });

    const dietPlan = await tx.dietPlan.create({
      data: {
        userId,
        weekStart: ws,
        status: 'active',
        source,
        targetCalories: Math.round(dt.calories),
        targetProteinG: Math.round(dt.protein),
        targetCarbsG: Math.round(dt.carbs),
        targetFatG: Math.round(dt.fat),
        aiNotes: planData.coachNotes || null,
        explainabilityText: explain || null,
        locale,
        days: {
          create: (planData.dietDays || []).map((day) => ({
            dayIndex: day.dayIndex,
            meals: {
              create: (day.meals || []).map((meal) => ({
                mealType: meal.slot || 'meal',
                items: {
                  create: (meal.items || []).map((item) => ({
                    foodItemId: item.foodItemId || null,
                    label: item.name,
                    quantity: item.grams,
                    unit: 'g',
                  })),
                },
              })),
            },
          })),
        },
      },
      include: {
        days: { include: { meals: { include: { items: true } } } },
      },
    });

    const workoutPlan = await tx.workoutPlan.create({
      data: {
        userId,
        weekStart: ws,
        status: 'active',
        source,
        aiNotes: planData.coachNotes || null,
        explainabilityText: explain || null,
        locale,
        days: {
          create: await Promise.all(
            (planData.workoutWeeks?.[0]?.days || planData.workoutWeeks?.flatMap((w) => w.days) || []).map(
              async (day) => {
                const focus = day.type || day.label || null;
                let exerciseRows = await resolveExercisesForPersist(tx, day.exercises);
                const rest = inferIsRestWorkoutDay({
                  ...day,
                  focus,
                  isRestDay: day.isRest,
                  exercises: exerciseRows.map((r) => ({ exerciseId: r.exerciseId })),
                });
                if (!rest && exerciseRows.length === 0) {
                  const fallback = await defaultExerciseRowForFocus(tx, {
                    focus,
                    type: day.type,
                    isRest: day.isRest,
                  });
                  if (fallback) exerciseRows = [fallback];
                }
                return {
                  dayIndex: day.dayIndex,
                  focus,
                  isRestDay: exerciseRows.length === 0 ? Boolean(day.isRest) : false,
                  exercises: { create: exerciseRows },
                };
              }
            )
          ),
        },
      },
      include: {
        days: {
          include: {
            exercises: {
              include: { exercise: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    return { workoutPlan, dietPlan };
    },
    { timeout: txTimeoutMs, maxWait: 10_000 }
  );

  logger.info(
    {
      userId,
      version,
      workoutPlanId: result.workoutPlan.id,
      dietPlanId: result.dietPlan.id,
      legacySource,
      prismaSource: source,
    },
    'Plan persisted to Postgres'
  );

  return toLegacyPlanDocument({
    userId,
    workoutPlan: result.workoutPlan,
    dietPlan: result.dietPlan,
    planData,
    legacySource,
    locale,
    version,
  });
}

/**
 * Load active plan as legacy Mongo-shaped document for dashboard/coach.
 * @param {string} userId
 */
async function fetchActivePlanFromPostgres(userId) {
  const [workoutPlan, dietPlan] = await Promise.all([
    prisma.workoutPlan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { weekStart: 'desc' },
      include: {
        days: {
          orderBy: { dayIndex: 'asc' },
          include: {
            exercises: {
              orderBy: { sortOrder: 'asc' },
              include: { exercise: { select: { id: true, name: true } } },
            },
          },
        },
      },
    }),
    prisma.dietPlan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { weekStart: 'desc' },
      include: {
        days: {
          orderBy: { dayIndex: 'asc' },
          include: {
            meals: {
              orderBy: { mealType: 'asc' },
              include: {
                items: {
                  include: {
                    foodItem: {
                      select: {
                        id: true,
                        name: true,
                        calories: true,
                        protein: true,
                        carbs: true,
                        fat: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  if (!workoutPlan && !dietPlan) return null;

  const version = await prisma.workoutPlan.count({ where: { userId } });
  const legacySource = inferLegacySource({
    explainabilityText: workoutPlan?.explainabilityText || dietPlan?.explainabilityText,
    aiNotes: workoutPlan?.aiNotes || dietPlan?.aiNotes,
  });

  const dailyTargets = {
    calories: dietPlan?.targetCalories ?? 2000,
    protein: dietPlan?.targetProteinG ?? 120,
    carbs: dietPlan?.targetCarbsG ?? 200,
    fat: dietPlan?.targetFatG ?? 60,
    waterMl: 2500,
  };

  const dietDays = (dietPlan?.days || []).map((day) => ({
    dayIndex: day.dayIndex,
    label: '',
    meals: (day.meals || []).map((meal) => ({
      slot: meal.mealType,
      items: (meal.items || []).map((item) => {
        const macros = mealItemMacrosFromFoodRow(item);
        return {
          foodItemId: item.foodItemId,
          webtebId: null,
          name: item.label || item.foodItem?.name || 'Meal',
          grams: item.quantity ?? 100,
          calories: macros.calories,
          protein: macros.protein,
          carbs: macros.carbs,
          fat: macros.fat,
          notes: '',
        };
      }),
    })),
  }));

  const weekDays = workoutPlan?.days || [];
  const workoutWeeks = [
    {
      weekIndex: 1,
      days: weekDays.map((day) => ({
        dayIndex: day.dayIndex,
        type: day.focus || (day.isRestDay ? 'rest' : 'full'),
        label: day.focus || '',
        isRest: day.isRestDay,
        exercises: (day.exercises || []).map((row) => ({
          exerciseId: row.exerciseId,
          name: row.exercise?.name || row.notes || 'Exercise',
          sets: row.sets ?? 3,
          reps: Number.parseInt(String(row.reps), 10) || 10,
          restSec: row.restSec ?? 90,
          notes: row.notes || '',
        })),
      })),
    },
  ];

  const planData = {
    dailyTargets,
    dietDays,
    workoutWeeks,
    coachNotes: (() => {
      const notes = workoutPlan?.aiNotes || dietPlan?.aiNotes || '';
      return isBoilerplateCoachNotes(notes) ? '' : notes;
    })(),
  };

  return toLegacyPlanDocument({
    userId,
    workoutPlan,
    dietPlan,
    planData,
    legacySource,
    locale: workoutPlan?.locale || dietPlan?.locale || 'ar',
    version,
  });
}

/**
 * Plan history summaries for API (Postgres only).
 * @param {string} userId
 * @param {number} [limit=10]
 */
async function fetchPlanHistoryFromPostgres(userId, limit = 10) {
  const rows = await prisma.workoutPlan.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      weekStart: true,
      status: true,
      source: true,
      locale: true,
      explainabilityText: true,
      aiNotes: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return rows.map((row, index) => ({
    _id: row.id,
    userId,
    version: rows.length - index,
    isActive: row.status === 'active',
    source: row.source === 'onboarding' ? 'ai' : row.source === 'manual' ? 'ai' : 'fallback',
    locale: row.locale,
    coachNotes: row.aiNotes || '',
    explainabilityText: row.explainabilityText || '',
    weekStart: row.weekStart,
    status: row.status,
    storage: 'postgres',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

module.exports = {
  persistPlanToPostgres,
  fetchActivePlanFromPostgres,
  fetchPlanHistoryFromPostgres,
  toLegacyPlanDocument,
  mapLegacySourceToPrisma,
};

