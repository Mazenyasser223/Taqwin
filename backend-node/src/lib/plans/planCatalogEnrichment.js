/**

 * Bind retrieved catalog rows to plan JSON before validation / persist.

 */

const { prisma } = require('../../db');
const { itemHasMacros } = require('./planMealShape');



function normalizeName(name) {

  return String(name || '')

    .trim()

    .toLowerCase();

}

const FOOD_TOKEN_SKIP = new Set([
  'with', 'and', 'the', 'raw', 'cooked', 'grilled', 'baked', 'boiled', 'steamed', 'fried',
  'bowl', 'plate', 'salad', 'sandwich', 'wrap', 'soup', 'stew', 'meal', 'snack',
  'breakfast', 'lunch', 'dinner', 'medium', 'large', 'small', 'serving', 'portion',
  'homemade', 'fresh', 'healthy', 'style', 'dish', 'combo',
]);

function meaningfulFoodTokens(name) {
  return normalizeName(name)
    .split(/[^a-z0-9\u0600-\u06ff]+/)
    .filter((token) => token.length > 2 && !FOOD_TOKEN_SKIP.has(token));
}

function scoreFoodMatch(mealName, foodRow) {
  const mealTokens = meaningfulFoodTokens(mealName);
  if (!mealTokens.length) return 0;
  const foodTokens = [
    ...meaningfulFoodTokens(foodRow.name),
    ...(foodRow.nameAr ? meaningfulFoodTokens(foodRow.nameAr) : []),
  ];
  if (!foodTokens.length) return 0;
  let score = 0;
  for (const token of mealTokens) {
    for (const foodToken of foodTokens) {
      if (token === foodToken) score += 3;
      else if (token.includes(foodToken) || foodToken.includes(token)) score += 1;
    }
  }
  return score;
}

function assignCatalogFoodToItem(item, hit, validFoodIds = null) {
  if (hit.id && (!validFoodIds || validFoodIds.has(hit.id))) {
    item.foodItemId = hit.id;
  }
  if (hit.webtebId != null) item.webtebId = hit.webtebId;
  Object.assign(item, scaleFoodMacros(hit, item.grams));
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

function mealHasMacros(meal) {
  return (meal.items || []).some((item) => itemHasMacros(item));
}

function scaleFoodMacros(food, grams) {
  const g = Math.max(Number(grams) || 0, 0);
  const factor = g / 100;
  return {
    calories: Math.max(0, Math.round((Number(food.calories) || 0) * factor)),
    protein: Math.round((Number(food.protein) || 0) * factor * 10) / 10,
    carbs: Math.round((Number(food.carbs) || 0) * factor * 10) / 10,
    fat: Math.round((Number(food.fat) || 0) * factor * 10) / 10,
  };
}

/**
 * @param {Array<{ id?: string, name?: string, nameAr?: string, webtebId?: number|null, calories?: number, protein?: number, carbs?: number, fat?: number }>} catalog
 */
function buildFoodNameIndex(catalog) {
  const exact = new Map();
  for (const row of catalog || []) {
    if (!row?.name) continue;
    exact.set(normalizeName(row.name), row);
    if (row.nameAr) exact.set(normalizeName(row.nameAr), row);
  }
  return exact;
}

function resolveFoodFromCatalog(name, index, catalog) {
  const key = normalizeName(name);
  if (!key) return null;
  if (index.has(key)) return index.get(key);
  for (const row of catalog || []) {
    const rn = normalizeName(row.name);
    const ra = row.nameAr ? normalizeName(row.nameAr) : '';
    if ((rn && (key.includes(rn) || rn.includes(key))) || (ra && (key.includes(ra) || ra.includes(key)))) {
      return row;
    }
  }
  let best = null;
  let bestScore = 0;
  for (const row of catalog || []) {
    const score = scoreFoodMatch(name, row);
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  return bestScore >= 2 ? best : null;
}

/**
 * Compute meal macros from the RAG food pool when Claude only returned name + grams.
 * @param {object} planData
 * @param {object[]} foodCatalog
 */
function applyCatalogMacrosToPlan(planData, foodCatalog, validFoodIds = null) {
  if (!planData?.dietDays?.length || !foodCatalog?.length) return planData;
  const index = buildFoodNameIndex(foodCatalog);
  for (const day of planData.dietDays) {
    for (const meal of day.meals || []) {
      for (const item of meal.items || []) {
        if (itemHasMacros(item) || !item.name) continue;
        const hit = resolveFoodFromCatalog(item.name, index, foodCatalog);
        if (!hit) continue;
        assignCatalogFoodToItem(item, hit, validFoodIds);
      }
    }
  }
  return planData;
}

async function applyDbMacrosToItem(item) {
  if (itemHasMacros(item)) return;
  const select = {
    id: true,
    name: true,
    calories: true,
    protein: true,
    carbs: true,
    fat: true,
  };
  let row = null;
  if (item.foodItemId) {
    row = await prisma.foodItem.findUnique({ where: { id: item.foodItemId }, select });
  } else if (item.name) {
    row = await prisma.foodItem.findFirst({
      where: { name: { equals: String(item.name).trim(), mode: 'insensitive' } },
      select,
    });
    if (row) item.foodItemId = row.id;
  }
  if (row) Object.assign(item, scaleFoodMacros(row, item.grams));
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

      for (const item of meal.items || []) {

        await applyDbMacrosToItem(item);

        if (item.foodItemId) continue;

        if (!item.name) continue;

        const id = await ensureFoodItemIdForMeal(item);

        if (id) {
          item.foodItemId = id;
          await applyDbMacrosToItem(item);
        }

      }

    }

  }

  return planData;

}



/**
 * Drop hallucinated LLM IDs and re-bind items from the RAG food pool by name.
 * @param {object} planData
 * @param {object[]} foodCatalog
 */
async function reconcilePlanFoodItemIds(planData, foodCatalog = []) {
  if (!planData?.dietDays?.length) return planData;

  const foodIds = new Set();
  const webtebIds = new Set();
  for (const day of planData.dietDays) {
    for (const meal of day.meals || []) {
      for (const item of meal.items || []) {
        if (item.foodItemId) foodIds.add(item.foodItemId);
        if (item.webtebId != null) webtebIds.add(item.webtebId);
      }
    }
  }

  const validFoodIds = new Set();
  if (foodIds.size) {
    const found = await prisma.foodItem.findMany({
      where: { id: { in: [...foodIds] } },
      select: { id: true },
    });
    for (const row of found) validFoodIds.add(row.id);
  }

  const catalogIds = [...new Set((foodCatalog || []).map((row) => row.id).filter(Boolean))];
  if (catalogIds.length) {
    const foundCatalog = await prisma.foodItem.findMany({
      where: { id: { in: catalogIds } },
      select: { id: true },
    });
    for (const row of foundCatalog) validFoodIds.add(row.id);
  }

  const validWebtebIds = new Set();
  if (webtebIds.size) {
    const found = await prisma.webtebFood.findMany({
      where: { webtebId: { in: [...webtebIds] } },
      select: { webtebId: true },
    });
    for (const row of found) validWebtebIds.add(row.webtebId);
  }

  const index = buildFoodNameIndex(foodCatalog);
  for (const day of planData.dietDays) {
    for (const meal of day.meals || []) {
      for (const item of meal.items || []) {
        if (item.foodItemId && !validFoodIds.has(item.foodItemId)) {
          item.foodItemId = null;
        }
        if (item.webtebId != null && !validWebtebIds.has(item.webtebId)) {
          item.webtebId = null;
        }
        if (!item.foodItemId && item.name) {
          const hit = resolveFoodFromCatalog(item.name, index, foodCatalog);
          if (hit) assignCatalogFoodToItem(item, hit, validFoodIds);
        }
      }
    }
  }

  return planData;
}

/**
 * Final pass: null any foodItemId / webtebId not present in Postgres.
 * @param {object} planData
 */
async function sanitizePlanFoodItemIds(planData) {
  if (!planData?.dietDays?.length) return planData;

  const foodIds = new Set();
  const webtebIds = new Set();
  for (const day of planData.dietDays) {
    for (const meal of day.meals || []) {
      for (const item of meal.items || []) {
        if (item.foodItemId) foodIds.add(item.foodItemId);
        if (item.webtebId != null) webtebIds.add(item.webtebId);
      }
    }
  }

  const validFoodIds = foodIds.size
    ? new Set(
        (
          await prisma.foodItem.findMany({
            where: { id: { in: [...foodIds] } },
            select: { id: true },
          })
        ).map((row) => row.id)
      )
    : new Set();

  const validWebtebIds = webtebIds.size
    ? new Set(
        (
          await prisma.webtebFood.findMany({
            where: { webtebId: { in: [...webtebIds] } },
            select: { webtebId: true },
          })
        ).map((row) => row.webtebId)
      )
    : new Set();

  for (const day of planData.dietDays) {
    for (const meal of day.meals || []) {
      for (const item of meal.items || []) {
        if (item.foodItemId && !validFoodIds.has(item.foodItemId)) item.foodItemId = null;
        if (item.webtebId != null && !validWebtebIds.has(item.webtebId)) item.webtebId = null;
      }
    }
  }

  return planData;
}



module.exports = {

  enrichPlanExerciseIds,

  enrichPlanExerciseIdsFromDb,

  enrichPlanDietFoodItemsFromDb,

  applyCatalogMacrosToPlan,

  reconcilePlanFoodItemIds,

  sanitizePlanFoodItemIds,

  ensureExerciseIdByName,

  ensureFoodItemIdForMeal,

};

