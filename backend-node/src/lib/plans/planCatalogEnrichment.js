/**

 * Bind retrieved catalog rows to plan JSON before validation / persist.

 */

const { prisma } = require('../../db');



function normalizeName(name) {

  return String(name || '')

    .trim()

    .toLowerCase();

}



function planStubMuscleWikiId(name) {

  const slug = normalizeName(name).replace(/\s+/g, '-');

  let h = 0;

  for (let i = 0; i < slug.length; i += 1) {

    h = (h * 31 + slug.charCodeAt(i)) >>> 0;

  }

  return 1_000_000 + (h % 899_000);

}



function macrosPer100FromMeal(meal) {

  const grams = Math.max(Number(meal.grams) || 100, 1);

  const factor = 100 / grams;

  return {

    calories: Math.max(0, Math.round((Number(meal.calories) || 0) * factor)),

    protein: Math.max(0, Number(((Number(meal.protein) || 0) * factor).toFixed(2))),

    carbs: Math.max(0, Number(((Number(meal.carbs) || 0) * factor).toFixed(2))),

    fat: Math.max(0, Number(((Number(meal.fat) || 0) * factor).toFixed(2))),

  };

}



/**

 * @param {Array<{ id: string, name: string }>} catalog

 */

function buildExerciseNameIndex(catalog) {

  const exact = new Map();

  for (const row of catalog || []) {

    if (!row?.id || !row?.name) continue;

    exact.set(normalizeName(row.name), row.id);

  }

  return exact;

}



/**

 * @param {object} planData

 * @param {Array<{ id: string, name: string }>} exerciseCatalog

 */

function enrichPlanExerciseIds(planData, exerciseCatalog) {

  if (!planData?.workoutWeeks?.length) return planData;

  const index = buildExerciseNameIndex(exerciseCatalog);



  for (const week of planData.workoutWeeks) {

    for (const day of week.days || []) {

      for (const ex of day.exercises || []) {

        if (ex.exerciseId) continue;

        const key = normalizeName(ex.name);

        const hit = index.get(key);

        if (hit) ex.exerciseId = hit;

      }

    }

  }

  return planData;

}



/**

 * @param {string} name

 */

async function ensureExerciseIdByName(name) {

  const trimmed = String(name || '').trim();

  if (!trimmed) return null;



  const found = await prisma.exercise.findFirst({

    where: { name: { equals: trimmed, mode: 'insensitive' } },

    select: { id: true },

  });

  if (found) return found.id;



  const muscleWikiId = planStubMuscleWikiId(trimmed);

  try {

    const created = await prisma.exercise.create({

      data: {

        muscleWikiId,

        name: trimmed,

        category: 'general',

        primaryMuscles: [],

        steps: [],

        videos: [],

        source: 'plan_fallback',

        isPublic: true,

      },

      select: { id: true },

    });

    return created.id;

  } catch {

    const byMw = await prisma.exercise.findFirst({

      where: { muscleWikiId },

      select: { id: true },

    });

    if (byMw) return byMw.id;

    const retry = await prisma.exercise.findFirst({

      where: { name: { equals: trimmed, mode: 'insensitive' } },

      select: { id: true },

    });

    return retry?.id ?? null;

  }

}



/**

 * @param {{ name?: string, grams?: number, calories?: number, protein?: number, carbs?: number, fat?: number, foodItemId?: string|null }} meal

 */

async function ensureFoodItemIdForMeal(meal) {

  const name = String(meal.name || '').trim();

  if (!name) return null;



  const existing = await prisma.foodItem.findFirst({

    where: { name: { equals: name, mode: 'insensitive' } },

    select: { id: true, protein: true, calories: true },

  });

  if (existing && ((existing.protein ?? 0) > 0 || (existing.calories ?? 0) > 0)) {

    return existing.id;

  }



  const per100 = macrosPer100FromMeal(meal);

  if (per100.calories <= 0 && per100.protein <= 0) return existing?.id ?? null;



  if (existing) {

    await prisma.foodItem.update({

      where: { id: existing.id },

      data: {

        calories: per100.calories || existing.calories,

        protein: per100.protein || existing.protein,

        carbs: per100.carbs,

        fat: per100.fat,

      },

    });

    return existing.id;

  }



  const created = await prisma.foodItem.create({

    data: {

      name,

      category: 'plan_meal',

      calories: per100.calories || 100,

      protein: per100.protein,

      carbs: per100.carbs,

      fat: per100.fat,

      isPublic: true,

    },

    select: { id: true },

  });

  return created.id;

}



/**

 * Resolve exercise names against DB; create minimal public rows when catalog is incomplete.

 * @param {object} planData

 */

async function enrichPlanExerciseIdsFromDb(planData) {

  if (!planData?.workoutWeeks?.length) return planData;



  for (const week of planData.workoutWeeks) {

    for (const day of week.days || []) {

      if (day.isRest) continue;

      for (const ex of day.exercises || []) {

        if (ex.exerciseId || !ex.name) continue;

        const name = String(ex.name).trim();

        const found = await prisma.exercise.findFirst({

          where: { name: { equals: name, mode: 'insensitive' } },

          select: { id: true },

        });

        if (found) {

          ex.exerciseId = found.id;

          continue;

        }

        const id = await ensureExerciseIdByName(name);

        if (id) ex.exerciseId = id;

      }

    }

  }

  return planData;

}



/**

 * Link diet meals to FoodItem rows so C6/C7 API macros are non-zero after persist.

 * @param {object} planData

 */

async function enrichPlanDietFoodItemsFromDb(planData) {

  if (!planData?.dietDays?.length) return planData;



  for (const day of planData.dietDays) {

    for (const meal of day.meals || []) {

      if (meal.foodItemId) continue;

      const hasMacros =

        (meal.protein ?? 0) > 0 ||

        (meal.calories ?? 0) > 0 ||

        (meal.carbs ?? 0) > 0 ||

        (meal.fat ?? 0) > 0;

      if (!hasMacros && !meal.name) continue;

      const id = await ensureFoodItemIdForMeal(meal);

      if (id) meal.foodItemId = id;

    }

  }

  return planData;

}



module.exports = {

  enrichPlanExerciseIds,

  enrichPlanExerciseIdsFromDb,

  enrichPlanDietFoodItemsFromDb,

  ensureExerciseIdByName,

  ensureFoodItemIdForMeal,

};

