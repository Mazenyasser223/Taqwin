/**
 * Build a UI-friendly nutrition details payload from a USDA FDC food record.
 */
const { extractMacrosPer100g, formatFoodCategory } = require('../services/fdcService');

const MACRO_IDS = new Set([1003, 1004, 1005, 1008, 2047, 2048]);
const MACRO_NUMBERS = new Set(['203', '204', '205', '208']);

const VITAMIN_RE =
  /vitamin|folate|folic|biotin|choline|retinol|carotene|tocopherol|niacin|riboflavin|thiamin|pantothen|cobalamin|ascorbic|phylloquinone|pyridoxine/i;
const MINERAL_RE =
  /calcium|iron|magnesium|phosphorus|potassium|sodium|zinc|copper|manganese|selenium|iodine|fluoride|chromium|molybdenum|chloride/i;

function readAmount(hit) {
  const v = hit?.amount ?? hit?.value;
  if (v == null || Number.isNaN(Number(v))) return null;
  return Number(v);
}

function formatAmount(value, unit) {
  if (value == null) return '—';
  const u = (unit || '').trim();
  if (value > 0 && value < 0.1) return `<0.1${u ? ` ${u}` : ''}`;
  const rounded = value >= 10 ? Math.round(value * 10) / 10 : Math.round(value * 100) / 100;
  return u ? `${rounded} ${u}` : String(rounded);
}

function isMacro(hit) {
  const id = hit.nutrient?.id ?? hit.nutrientId;
  const num = String(hit.nutrient?.number ?? hit.nutrientNumber ?? hit.number ?? '');
  if (id != null && MACRO_IDS.has(id)) return true;
  return MACRO_NUMBERS.has(num);
}

function normalizeNutrientRow(hit) {
  const amount = readAmount(hit);
  if (amount == null || amount <= 0) return null;
  const name = hit.nutrient?.name || hit.nutrientName || hit.name || 'Unknown';
  const unit = hit.nutrient?.unitName || hit.unitName || '';
  return {
    id: hit.nutrient?.id ?? hit.nutrientId ?? (hit.number ? Number(hit.number) : null),
    name,
    amount,
    unit,
    display: formatAmount(amount, unit),
  };
}

function classifyNutrient(row) {
  const n = row.name;
  if (VITAMIN_RE.test(n)) return 'vitamin';
  if (MINERAL_RE.test(n)) return 'mineral';
  return 'other';
}

function dedupeAndSort(rows) {
  const byName = new Map();
  for (const row of rows) {
    const key = row.name.toLowerCase();
    const prev = byName.get(key);
    if (!prev || row.amount > prev.amount) byName.set(key, row);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function toFoodDetails(fdcFood) {
  const macros = extractMacrosPer100g(fdcFood);
  const fromCarbs = Math.round(macros.carbs * 4);
  const fromProtein = Math.round(macros.protein * 4);
  const fromFat = Math.round(macros.fat * 9);
  const calSum = fromCarbs + fromProtein + fromFat;

  const hits = (fdcFood.foodNutrients || []).filter((h) => !isMacro(h));
  const parsed = hits.map(normalizeNutrientRow).filter(Boolean);

  const vitamins = [];
  const minerals = [];
  const other = [];

  for (const row of parsed) {
    const kind = classifyNutrient(row);
    if (kind === 'vitamin') vitamins.push(row);
    else if (kind === 'mineral') minerals.push(row);
    else other.push(row);
  }

  const category =
    formatFoodCategory(fdcFood.foodCategory) || formatFoodCategory(fdcFood.brandedFoodCategory);

  return {
    fdcId: fdcFood.fdcId,
    name: fdcFood.description || fdcFood.lowercaseDescription || 'Unknown food',
    dataType: fdcFood.dataType || null,
    foodCategory: category,
    servingLabel:
      fdcFood.servingSize && fdcFood.servingSizeUnit
        ? `${fdcFood.servingSize} ${fdcFood.servingSizeUnit}`
        : null,
    macros,
    calorieBreakdown: {
      total: macros.calories,
      fromCarbs,
      fromProtein,
      fromFat,
      computedTotal: calSum,
    },
    vitamins: dedupeAndSort(vitamins),
    minerals: dedupeAndSort(minerals),
    nutrients: dedupeAndSort(other),
  };
}

module.exports = { toFoodDetails, formatAmount };
