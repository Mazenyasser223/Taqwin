/**
 * Normalize USDA FDC food records from search, full, or abridged API shapes.
 */

function normalizeNutrientHit(hit) {
  if (!hit) return hit;

  const amount = hit.amount ?? hit.value;
  const nested = hit.nutrient;

  if (nested && (nested.id != null || nested.name)) {
    return {
      ...hit,
      amount,
      value: amount,
      nutrientId: hit.nutrientId ?? nested.id,
      nutrientNumber: hit.nutrientNumber ?? nested.number,
      nutrient: nested,
    };
  }

  const number = hit.number ?? hit.nutrientNumber;
  const nutrientId = hit.nutrientId ?? (number && /^\d+$/.test(String(number)) ? Number(number) : null);

  return {
    amount,
    value: amount,
    nutrientId,
    nutrientNumber: number != null ? String(number) : undefined,
    nutrientName: hit.name ?? hit.nutrientName,
    unitName: hit.unitName,
    nutrient: {
      id: nutrientId,
      number: number != null ? String(number) : '',
      name: hit.name ?? hit.nutrientName ?? 'Unknown',
      unitName: hit.unitName ?? '',
    },
  };
}

function normalizeFdcFoodRecord(food) {
  if (!food) return food;
  return {
    ...food,
    foodNutrients: (food.foodNutrients || []).map(normalizeNutrientHit),
  };
}

module.exports = { normalizeNutrientHit, normalizeFdcFoodRecord };
