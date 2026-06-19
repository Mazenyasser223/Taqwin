/**
 * Canonical diet meal shape: { slot, items: [{ name, grams, ... }] }.
 * Legacy flat rows ({ slot, name, grams }) are normalized on ingest.
 */

function itemFromFlatMeal(meal) {
  return {
    foodItemId: meal.foodItemId ?? null,
    webtebId: meal.webtebId ?? null,
    name: String(meal.name || meal.label || '').trim(),
    grams: Number(meal.grams ?? meal.quantity),
    calories: meal.calories ?? 0,
    protein: meal.protein ?? 0,
    carbs: meal.carbs ?? 0,
    fat: meal.fat ?? 0,
    notes: meal.notes || '',
  };
}

function isSlotMealShape(meal) {
  return Boolean(meal && typeof meal === 'object' && Array.isArray(meal.items) && meal.items.length > 0);
}

function isFlatMealShape(meal) {
  if (!meal || typeof meal !== 'object') return false;
  const name = String(meal.name || meal.label || '').trim();
  const grams = Number(meal.grams ?? meal.quantity);
  return Boolean(name && Number.isFinite(grams) && grams > 0);
}

/**
 * @param {object} meal
 * @returns {object}
 */
function normalizeMealToSlotShape(meal) {
  if (!meal || typeof meal !== 'object') return { slot: 'meal', items: [] };
  const slot = String(meal.slot || meal.mealType || meal.mealSlot || 'meal').trim() || 'meal';

  if (isSlotMealShape(meal)) {
    return {
      slot,
      items: meal.items.map((item) => ({
        foodItemId: item.foodItemId ?? null,
        webtebId: item.webtebId ?? null,
        name: String(item.name || item.label || '').trim(),
        grams: Number(item.grams ?? item.quantity),
        calories: item.calories ?? 0,
        protein: item.protein ?? 0,
        carbs: item.carbs ?? 0,
        fat: item.fat ?? 0,
        notes: item.notes || '',
      })).filter((item) => item.name && Number.isFinite(item.grams) && item.grams > 0),
    };
  }

  if (isFlatMealShape(meal)) {
    return { slot, items: [itemFromFlatMeal(meal)] };
  }

  return { slot, items: [] };
}

/**
 * Group legacy flat meal rows by slot into slot+items[] meals.
 * @param {object[]} meals
 */
function normalizeDietDayMeals(meals) {
  const out = [];
  const slotIndex = new Map();

  for (const raw of meals || []) {
    if (isSlotMealShape(raw)) {
      const normalized = normalizeMealToSlotShape(raw);
      if (!normalized.items.length) continue;
      const existingIdx = slotIndex.get(normalized.slot);
      if (existingIdx != null) {
        out[existingIdx].items.push(...normalized.items);
      } else {
        slotIndex.set(normalized.slot, out.length);
        out.push(normalized);
      }
      continue;
    }

    if (!isFlatMealShape(raw)) continue;
    const slot = String(raw.slot || raw.mealType || 'meal').trim() || 'meal';
    const item = itemFromFlatMeal(raw);
    const existingIdx = slotIndex.get(slot);
    if (existingIdx != null) {
      out[existingIdx].items.push(item);
    } else {
      slotIndex.set(slot, out.length);
      out.push({ slot, items: [item] });
    }
  }

  return out;
}

/**
 * @param {object} plan
 */
function normalizeDietMealsToSlotShape(plan) {
  if (!plan?.dietDays?.length) return plan;
  for (const day of plan.dietDays) {
    if (!Array.isArray(day.meals)) continue;
    day.meals = normalizeDietDayMeals(day.meals);
  }
  return plan;
}

/**
 * @param {object} meal
 * @returns {object[]}
 */
function mealSlotItems(meal) {
  if (isSlotMealShape(meal)) return meal.items;
  if (isFlatMealShape(meal)) return [itemFromFlatMeal(meal)];
  return [];
}

/**
 * @param {object} day
 * @returns {object[]}
 */
function iterDietDayItems(day) {
  const items = [];
  for (const meal of day?.meals || []) {
    items.push(...mealSlotItems(meal));
  }
  return items;
}

function dayProteinSum(day) {
  return iterDietDayItems(day).reduce((sum, item) => sum + (Number(item.protein) || 0), 0);
}

function itemHasMacros(item) {
  return (
    (item?.protein ?? 0) > 0 ||
    (item?.calories ?? 0) > 0 ||
    (item?.carbs ?? 0) > 0 ||
    (item?.fat ?? 0) > 0
  );
}

module.exports = {
  normalizeDietMealsToSlotShape,
  normalizeDietDayMeals,
  normalizeMealToSlotShape,
  mealSlotItems,
  iterDietDayItems,
  dayProteinSum,
  itemHasMacros,
  isSlotMealShape,
  isFlatMealShape,
  itemFromFlatMeal,
};
