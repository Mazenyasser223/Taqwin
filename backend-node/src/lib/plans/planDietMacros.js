/**
 * Per-item macros for diet plan API responses (FoodItem quantities in grams).
 */

function scaleMacro(per100, grams) {
  const g = Math.max(Number(grams) || 0, 0);
  if (!per100 || g <= 0) return 0;
  return Math.round(Number(per100) * (g / 100) * 10) / 10;
}

/**
 * FoodItem.calories is stored per 100g in catalog imports.
 * @param {{ quantity?: number, foodItem?: { calories?: number, protein?: number, carbs?: number, fat?: number } | null }} item
 */
function mealItemMacrosFromFoodRow(item) {
  const fi = item?.foodItem;
  const grams = item?.quantity ?? 100;
  if (!fi) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }
  const calPer100 = Number(fi.calories) || 0;
  const factor = grams / 100;
  return {
    calories: Math.max(0, Math.round(calPer100 * factor)),
    protein: scaleMacro(fi.protein, grams),
    carbs: scaleMacro(fi.carbs, grams),
    fat: scaleMacro(fi.fat, grams),
  };
}

/**
 * Prefer persisted meal JSON macros when present on the plan payload.
 * @param {{ calories?: number, protein?: number, carbs?: number, fat?: number, grams?: number, foodItem?: object }} meal
 */
function resolveMealMacros(meal) {
  const fromRow = mealItemMacrosFromFoodRow({
    quantity: meal.grams ?? meal.quantity,
    foodItem: meal.foodItem,
  });
  const hasPayload =
    (meal.calories ?? 0) > 0 ||
    (meal.protein ?? 0) > 0 ||
    (meal.carbs ?? 0) > 0 ||
    (meal.fat ?? 0) > 0;
  if (hasPayload) {
    return {
      calories: Math.round(Number(meal.calories) || fromRow.calories),
      protein: Number(meal.protein) || fromRow.protein,
      carbs: Number(meal.carbs) || fromRow.carbs,
      fat: Number(meal.fat) || fromRow.fat,
    };
  }
  return fromRow;
}

module.exports = {
  mealItemMacrosFromFoodRow,
  resolveMealMacros,
  scaleMacro,
};
