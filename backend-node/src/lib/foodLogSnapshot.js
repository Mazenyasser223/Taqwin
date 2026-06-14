/**
 * Food logs reference FoodItem rows that can change later (kitchen edits, meal-plan reuse).
 * Snapshots freeze per-100g macros and display name at log time.
 */

function macrosPer100FromLog(log) {
  if (log.snapshotCalories != null && Number.isFinite(Number(log.snapshotCalories))) {
    return {
      calories: Number(log.snapshotCalories),
      protein: Number(log.snapshotProtein ?? 0),
      carbs: Number(log.snapshotCarbs ?? 0),
      fat: Number(log.snapshotFat ?? 0),
    };
  }
  const food = log.foodItem;
  return {
    calories: food?.calories ?? 0,
    protein: food?.protein ?? 0,
    carbs: food?.carbs ?? 0,
    fat: food?.fat ?? 0,
  };
}

function scaledMacrosFromLog(log) {
  const factor = (log.grams ?? 0) / 100;
  const per100 = macrosPer100FromLog(log);
  return {
    calories: Math.round(per100.calories * factor),
    protein: Math.round(per100.protein * factor * 10) / 10,
    carbs: Math.round(per100.carbs * factor * 10) / 10,
    fat: Math.round(per100.fat * factor * 10) / 10,
  };
}

function per100FromFoodOrEntry(food, entry = null) {
  if (entry?.macrosPer100) {
    return {
      calories: entry.macrosPer100.calories,
      protein: entry.macrosPer100.protein,
      carbs: entry.macrosPer100.carbs,
      fat: entry.macrosPer100.fat,
    };
  }
  if (entry?.grams > 0 && entry.calories != null) {
    const factor = 100 / entry.grams;
    return {
      calories: Math.max(1, Math.round(entry.calories * factor)),
      protein: Math.round((entry.protein ?? 0) * factor * 10) / 10,
      carbs: Math.round((entry.carbs ?? 0) * factor * 10) / 10,
      fat: Math.round((entry.fat ?? 0) * factor * 10) / 10,
    };
  }
  if (food) {
    return {
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
    };
  }
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

function snapshotFieldsFromPer100(name, per100) {
  return {
    snapshotName: name,
    snapshotCalories: per100.calories,
    snapshotProtein: per100.protein,
    snapshotCarbs: per100.carbs,
    snapshotFat: per100.fat,
  };
}

function attachSnapshotDisplay(food, log) {
  if (!food) return food;
  if (log.snapshotCalories == null) return food;
  const name = log.snapshotName ?? food.name;
  return {
    ...food,
    name,
    displayName: name,
    calories: log.snapshotCalories,
    protein: log.snapshotProtein ?? 0,
    carbs: log.snapshotCarbs ?? 0,
    fat: log.snapshotFat ?? 0,
  };
}

/** Prisma `select` fragment — include on food log queries that use explicit `select`. */
const FOOD_LOG_SNAPSHOT_SELECT = {
  snapshotName: true,
  snapshotCalories: true,
  snapshotProtein: true,
  snapshotCarbs: true,
  snapshotFat: true,
};

module.exports = {
  macrosPer100FromLog,
  scaledMacrosFromLog,
  per100FromFoodOrEntry,
  snapshotFieldsFromPer100,
  attachSnapshotDisplay,
  FOOD_LOG_SNAPSHOT_SELECT,
};
