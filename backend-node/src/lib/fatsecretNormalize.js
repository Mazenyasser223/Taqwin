/**
 * Map FatSecret food payloads to the FDC-shaped objects used by fdcService / fdcFoodDetails.
 */
const { asArray } = require('../services/fatsecretClient');

const NUTRIENT_FIELDS = [
  ['calories', 'Energy', 'kcal'],
  ['protein', 'Protein', 'g'],
  ['carbohydrate', 'Carbohydrate', 'g'],
  ['fat', 'Total lipid (fat)', 'g'],
  ['saturated_fat', 'Fatty acids, total saturated', 'g'],
  ['polyunsaturated_fat', 'Fatty acids, total polyunsaturated', 'g'],
  ['monounsaturated_fat', 'Fatty acids, total monounsaturated', 'g'],
  ['fiber', 'Fiber, total dietary', 'g'],
  ['sugar', 'Sugars, total', 'g'],
  ['sodium', 'Sodium, Na', 'mg'],
  ['potassium', 'Potassium, K', 'mg'],
  ['calcium', 'Calcium, Ca', 'mg'],
  ['iron', 'Iron, Fe', 'mg'],
  ['vitamin_a', 'Vitamin A, IU', 'IU'],
  ['vitamin_c', 'Vitamin C, total ascorbic acid', 'mg'],
  ['cholesterol', 'Cholesterol', 'mg'],
];

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseFoodDescription(desc) {
  if (!desc || typeof desc !== 'string') return null;
  const m = desc.match(
    /calories:\s*([\d.]+)\s*kcal.*fat:\s*([\d.]+)\s*g.*carbs:\s*([\d.]+)\s*g.*protein:\s*([\d.]+)\s*g/i
  );
  if (!m) return null;
  return {
    calories: num(m[1]) ?? 0,
    fat: num(m[2]) ?? 0,
    carbs: num(m[3]) ?? 0,
    protein: num(m[4]) ?? 0,
  };
}

function pickServing(servings) {
  const list = asArray(servings?.serving ?? servings);
  if (!list.length) return null;
  const per100 = list.find(
    (s) =>
      String(s.metric_serving_unit || '').toLowerCase() === 'g' &&
      Math.abs(Number(s.metric_serving_amount) - 100) < 0.01
  );
  if (per100) return per100;
  const flagged = list.find((s) => String(s.is_default || s.default_serving) === '1');
  if (flagged) return flagged;
  const grams = list.find((s) => String(s.metric_serving_unit || '').toLowerCase() === 'g');
  return grams || list[0];
}

function servingGrams(serving) {
  if (!serving) return 100;
  const unit = String(serving.metric_serving_unit || '').toLowerCase();
  const amount = num(serving.metric_serving_amount);
  if (unit === 'g' && amount && amount > 0) return amount;
  if (unit === 'ml' && amount && amount > 0) return amount;
  return 100;
}

function macrosFromServing(serving) {
  if (!serving) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const grams = servingGrams(serving);
  const factor = 100 / grams;
  const scale = (v) => Math.round((num(v) ?? 0) * factor * 10) / 10;
  const calories = Math.round((num(serving.calories) ?? 0) * factor);
  return {
    calories,
    protein: scale(serving.protein),
    carbs: scale(serving.carbohydrate),
    fat: scale(serving.fat),
  };
}

function buildFoodName(food) {
  const base = food.food_name || food.food_description || 'Unknown food';
  const brand = food.brand_name || food.brandName;
  return brand ? `${base}, ${brand}` : base;
}

function formatCategory(food) {
  const subs = food.food_sub_categories?.food_sub_category ?? food.food_sub_category;
  const arr = asArray(subs);
  if (arr.length) return String(arr[0]);
  return food.food_type || null;
}

function nutrientsFromServing(serving, factor = 1) {
  const rows = [];
  let id = 9000;
  for (const [key, name, unit] of NUTRIENT_FIELDS) {
    const raw = num(serving?.[key]);
    if (raw == null) continue;
    const amount = Math.round(raw * factor * 100) / 100;
    const nutrientId = id++;
    rows.push({
      nutrientId,
      nutrient: { id: nutrientId, name, unitName: unit },
      amount,
    });
  }
  return rows;
}

/** Convert food.get payload → FDC-like detail record. */
function fatsecretFoodToFdcShape(food) {
  const serving = pickServing(food.servings);
  const grams = servingGrams(serving);
  const factor = 100 / grams;
  const macros = macrosFromServing(serving);
  const subCats = food.food_sub_categories?.food_sub_category ?? food.food_sub_category;

  return {
    fdcId: Number(food.food_id),
    description: buildFoodName(food),
    lowercaseDescription: food.food_name || null,
    dataType: food.food_type === 'Brand' ? 'Branded' : 'Foundation',
    brandOwner: food.brand_name || null,
    foodCategory: formatCategory(food),
    brandedFoodCategory: null,
    servingSize: 100,
    servingSizeUnit: 'g',
    foodNutrients: nutrientsFromServing(serving, factor),
    labelNutrients: {
      calories: { value: macros.calories },
      protein: { value: macros.protein },
      carbohydrates: { value: macros.carbs },
      fat: { value: macros.fat },
    },
    _fatsecret: { serving, subCats: asArray(subCats) },
  };
}

/** Search hit → preview macros (per 100g). */
function previewMacrosFromSearchFood(food) {
  const serving = pickServing(food.servings);
  if (serving) return macrosFromServing(serving);
  const parsed = parseFoodDescription(food.food_description);
  if (parsed) return parsed;
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

module.exports = {
  asArray,
  parseFoodDescription,
  pickServing,
  servingGrams,
  macrosFromServing,
  buildFoodName,
  formatCategory,
  fatsecretFoodToFdcShape,
  previewMacrosFromSearchFood,
};
