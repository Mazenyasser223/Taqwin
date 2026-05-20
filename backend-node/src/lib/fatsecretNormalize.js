/**
 * Compatibility helpers for FatSecret data normalization.
 */

function numberOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function buildFoodName(food) {
  return (
    food?.food_name ||
    food?.foodName ||
    food?.name ||
    food?.description ||
    'Unknown food'
  );
}

function formatCategory(food) {
  return food?.food_type || food?.category || 'Generic';
}

function previewMacrosFromSearchFood(food) {
  return {
    calories: numberOrZero(food?.calories),
    protein: numberOrZero(food?.protein),
    carbs: numberOrZero(food?.carbs ?? food?.carbohydrate),
    fat: numberOrZero(food?.fat),
  };
}

function fatsecretFoodToFdcShape(food) {
  return {
    fdcId: String(food?.food_id ?? food?.id ?? ''),
    description: buildFoodName(food),
    dataType: formatCategory(food),
    foodNutrients: [],
  };
}

module.exports = {
  fatsecretFoodToFdcShape,
  previewMacrosFromSearchFood,
  buildFoodName,
  formatCategory,
};
