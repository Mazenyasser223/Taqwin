/**
 * Bind plan foods/exercises to Postgres catalog rows (no auto-create).
 * Unmatched items keep name + grams/sets and existing inline macros.
 */
const { prisma } = require('../../db');
const { iterDietDayItems } = require('./planMealShape');
const { scaleFoodMacros } = require('./planCatalogEnrichment');
const { resolveFoodFromPool, resolveExerciseFromPool } = require('../rag/planDietWorkoutMatch');

let webtebPoolCache = null;
let webtebPoolLoadedAt = 0;
let exercisePoolCache = null;
let exercisePoolLoadedAt = 0;
const POOL_TTL_MS = 10 * 60 * 1000;

async function loadWebtebPool() {
  const now = Date.now();
  if (webtebPoolCache && now - webtebPoolLoadedAt < POOL_TTL_MS) return webtebPoolCache;
  webtebPoolCache = await prisma.webtebFood.findMany({
    take: 4000,
    orderBy: { protein: 'desc' },
    select: {
      id: true,
      webtebId: true,
      nameEn: true,
      nameAr: true,
      calories: true,
      protein: true,
      carbs: true,
      fat: true,
    },
  });
  webtebPoolLoadedAt = now;
  return webtebPoolCache;
}

async function loadExercisePool() {
  const now = Date.now();
  if (exercisePoolCache && now - exercisePoolLoadedAt < POOL_TTL_MS) return exercisePoolCache;
  exercisePoolCache = await prisma.exercise.findMany({
    where: { isPublic: true },
    take: 5000,
    select: { id: true, name: true, nameAr: true, category: true },
  });
  exercisePoolLoadedAt = now;
  return exercisePoolCache;
}

function webtebRowToFoodHit(row) {
  return {
    id: null,
    webtebId: row.webtebId,
    name: row.nameEn || row.nameAr,
    nameAr: row.nameAr,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
  };
}

function applyWebtebToItem(item, row) {
  item.webtebId = row.webtebId;
  item.name = item.name || row.nameAr || row.nameEn;
  Object.assign(item, scaleFoodMacros(webtebRowToFoodHit(row), item.grams));
  return { method: 'webteb', score: 100 };
}

function applyFoodItemToItem(item, row) {
  item.foodItemId = row.id;
  item.name = item.name || row.name;
  Object.assign(item, scaleFoodMacros(row, item.grams));
  return { method: 'foodItem', score: 100 };
}

async function bindFoodItem(item, { webtebPool, foodCatalog = [] }) {
  const preservedMacros = {
    calories: item.calories,
    protein: item.protein,
    carbs: item.carbs,
    fat: item.fat,
  };

  if (item.webtebId != null) {
    const row = await prisma.webtebFood.findUnique({
      where: { webtebId: item.webtebId },
      select: {
        webtebId: true,
        nameEn: true,
        nameAr: true,
        calories: true,
        protein: true,
        carbs: true,
        fat: true,
      },
    });
    if (row) {
      item._bind = applyWebtebToItem(item, row);
      return item;
    }
    item.webtebId = null;
  }

  if (item.foodItemId) {
    const row = await prisma.foodItem.findUnique({
      where: { id: item.foodItemId },
      select: {
        id: true,
        name: true,
        calories: true,
        protein: true,
        carbs: true,
        fat: true,
      },
    });
    if (row) {
      item._bind = applyFoodItemToItem(item, row);
      return item;
    }
    item.foodItemId = null;
  }

  if (item.name) {
    const pool = webtebPool.length ? webtebPool : await loadWebtebPool();
    const match = resolveFoodFromPool(item.name, pool);
    if (match.row) {
      applyWebtebToItem(item, match.row);
      item._bind = { method: match.method, score: match.score };
      return item;
    }

    const catalogHit = (foodCatalog || []).find((row) => {
      const n = String(item.name).toLowerCase();
      return (
        String(row.name || '').toLowerCase() === n ||
        String(row.nameAr || '').toLowerCase() === n
      );
    });
    if (catalogHit?.webtebId != null) {
      const row = pool.find((r) => r.webtebId === catalogHit.webtebId);
      if (row) {
        applyWebtebToItem(item, row);
        item._bind = { method: 'catalog', score: 90 };
        return item;
      }
    }

    const foodRow = await prisma.foodItem.findFirst({
      where: { name: { equals: String(item.name).trim(), mode: 'insensitive' } },
      select: {
        id: true,
        name: true,
        calories: true,
        protein: true,
        carbs: true,
        fat: true,
      },
    });
    if (foodRow) {
      applyFoodItemToItem(item, foodRow);
      item._bind = { method: 'foodItem_name', score: 95 };
      return item;
    }
  }

  item._bind = { method: 'kept_as_is', score: 0 };
  if (preservedMacros.protein || preservedMacros.calories) {
    item.calories = preservedMacros.calories ?? item.calories ?? 0;
    item.protein = preservedMacros.protein ?? item.protein ?? 0;
    item.carbs = preservedMacros.carbs ?? item.carbs ?? 0;
    item.fat = preservedMacros.fat ?? item.fat ?? 0;
  }
  return item;
}

async function bindExerciseEntry(ex, { exercisePool }) {
  if (ex.exerciseId) {
    const found = await prisma.exercise.findUnique({
      where: { id: ex.exerciseId },
      select: { id: true, name: true },
    });
    if (found) {
      ex._bind = { method: 'exerciseId', score: 100 };
      ex.name = ex.name || found.name;
      return ex;
    }
    ex.exerciseId = null;
  }

  if (!ex.name) {
    ex._bind = { method: 'kept_as_is', score: 0 };
    return ex;
  }

  const name = String(ex.name).trim();
  const exact = await prisma.exercise.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (exact) {
    ex.exerciseId = exact.id;
    ex._bind = { method: 'name_exact', score: 100 };
    return ex;
  }

  const pool = exercisePool.length ? exercisePool : await loadExercisePool();
  const match = resolveExerciseFromPool(name, pool);
  if (match.row) {
    ex.exerciseId = match.row.id;
    ex.name = ex.name || match.row.name;
    ex._bind = { method: match.method, score: match.score };
    return ex;
  }

  ex._bind = { method: 'kept_as_is', score: 0 };
  return ex;
}

/**
 * @param {object} planData
 * @param {{ foodCatalog?: object[], exerciseCatalog?: object[] }} [options]
 */
async function bindPlanToCatalog(planData, options = {}) {
  if (!planData) return planData;

  const [webtebPool, exercisePool] = await Promise.all([loadWebtebPool(), loadExercisePool()]);

  if (planData.dietDays?.length) {
    for (const day of planData.dietDays) {
      for (const item of iterDietDayItems(day)) {
        await bindFoodItem(item, {
          webtebPool,
          foodCatalog: options.foodCatalog || [],
        });
      }
    }
  }

  if (planData.workoutWeeks?.length) {
    for (const week of planData.workoutWeeks) {
      for (const day of week.days || []) {
        if (day.isRest) continue;
        for (const ex of day.exercises || []) {
          await bindExerciseEntry(ex, { exercisePool });
        }
      }
    }
  }

  return planData;
}

function stripBindMetadata(planData) {
  if (!planData) return planData;
  for (const day of planData.dietDays || []) {
    for (const item of iterDietDayItems(day)) {
      delete item._bind;
    }
  }
  for (const week of planData.workoutWeeks || []) {
    for (const day of week.days || []) {
      for (const ex of day.exercises || []) {
        delete ex._bind;
      }
    }
  }
  return planData;
}

/**
 * Bind plan to DB catalogs; optionally legacy auto-create when PLAN_BIND_CREATE_MISSING=true.
 * @param {object} planData
 * @param {{ foodCatalog?: object[], exerciseCatalog?: object[] }} [options]
 */
async function finalizePlanCatalogBind(planData, options = {}) {
  const {
    reconcilePlanFoodItemIds,
    applyCatalogMacrosToPlan,
    enrichPlanExerciseIds,
    enrichPlanExerciseIdsFromDb,
    enrichPlanDietFoodItemsFromDb,
    sanitizePlanFoodItemIds,
  } = require('./planCatalogEnrichment');
  const { repairPlanProteinCoverage } = require('./planMacroRepair');

  const foodCatalog = options.foodCatalog || [];
  const exerciseCatalog = options.exerciseCatalog || [];
  const createMissing = process.env.PLAN_BIND_CREATE_MISSING === 'true';

  let next = planData;
  next = await reconcilePlanFoodItemIds(next, foodCatalog);
  next = await bindPlanToCatalog(next, { foodCatalog, exerciseCatalog });
  next = applyCatalogMacrosToPlan(next, foodCatalog);
  next = enrichPlanExerciseIds(next, exerciseCatalog);
  next = await enrichPlanDietFoodItemsFromDb(next);
  if (createMissing) {
    next = await enrichPlanExerciseIdsFromDb(next);
  }
  next = await sanitizePlanFoodItemIds(next);
  next = stripBindMetadata(next);
  return repairPlanProteinCoverage(next);
}

module.exports = {
  bindPlanToCatalog,
  stripBindMetadata,
  bindFoodItem,
  bindExerciseEntry,
  finalizePlanCatalogBind,
};
