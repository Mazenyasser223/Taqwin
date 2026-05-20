/**
 * Build structured nutrition facts from a USDA FDC food detail payload.
 */
const {
  extractMacrosPer100g,
  energyKcal,
  formatFoodCategory,
} = require('../services/fdcService');
const { sanitizeFoodName } = require('./foodNameSanitize');

/** Main macros only — minerals & vitamins live in their own sections. */
const GENERAL_NUTRIENT_IDS = [1008, 1003, 1004, 1005, 1079, 1253];

/** Ordered vitamins (USDA nutrient ids). */
const VITAMIN_NUTRIENT_IDS = [
  1178, // B-12
  1106, // A, IU
  1109, // E
  1114, // D (D2 + D3)
  1110, // D2
  1112, // D3
  1185, // K
  1175, // B-6
  1162, // C, total ascorbic acid
  1165, // C, ascorbic acid (alt)
  1166, // Thiamin — often grouped with vitamins in apps
  1167, // Riboflavin
  1168, // Niacin
  1170, // Pantothenic
  1177, // Folate, total
  1180, // Choline
  1190, // Betaine
];

/** Calcium, iron, sodium first (moved out of general / مغذيات). */
const MINERAL_NUTRIENT_IDS = [
  1087, // Ca
  1089, // Fe
  1093, // Na
  1090, // Mg
  1091, // P
  1092, // K
  1095, // Zn
  1098, // Cu
  1101, // Mn
  1103, // Se
  1099, // F
];

function readAmount(hit) {
  if (!hit) return null;
  const v = hit.amount ?? hit.value;
  if (v == null || Number.isNaN(Number(v))) return null;
  return Math.round(Number(v) * 100) / 100;
}

function normalizeNutrientRows(fdcFood) {
  const rows = [];
  const seen = new Set();

  for (const n of fdcFood.foodNutrients || []) {
    const id = n.nutrient?.id ?? n.nutrientId;
    const name = (n.nutrient?.name || n.nutrientName || '').trim();
    if (!name) continue;
    const unit = (n.nutrient?.unitName || n.unitName || '').trim();
    const amount = readAmount(n);
    if (amount == null) continue;
    const key = id ? `id:${id}` : `name:${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ id: id ?? null, name, amount, unit });
  }

  return rows;
}

function isVitaminName(name) {
  const l = name.toLowerCase();
  return /vitamin|thiamin|riboflavin|niacin|pantothenic|folate|folic|choline|betaine|biotin|tocopherol|retinol|cobalamin|pyridoxine|carotene|ascorbic|phylloquinone|ergocalciferol|cholecalciferol/.test(
    l,
  );
}

function isMineralName(name) {
  const l = name.toLowerCase();
  return /calcium|iron|magnesium|phosphorus|potassium|sodium|zinc|copper|manganese|selenium|fluoride|iodine|chromium|molybdenum|chloride|sulfur|sulphur/.test(
    l,
  );
}

function pickByOrderedIds(allRows, orderedIds) {
  const byId = new Map(allRows.filter((r) => r.id != null).map((r) => [r.id, r]));
  const picked = [];
  const used = new Set();
  for (const id of orderedIds) {
    const row = byId.get(id);
    if (row) {
      picked.push(row);
      used.add(row.name);
    }
  }
  return { picked, used };
}

function pickGeneralNutrients(allRows) {
  const { picked } = pickByOrderedIds(allRows, GENERAL_NUTRIENT_IDS);
  if (picked.length >= 4) return picked;

  const fallbackNames = ['energy', 'protein', 'total lipid', 'carbohydrate', 'fiber', 'cholesterol'];
  const lower = new Map(allRows.map((r) => [r.name.toLowerCase(), r]));
  for (const fragment of fallbackNames) {
    const hit = [...lower.entries()].find(([k]) => k.includes(fragment));
    if (hit && !picked.some((p) => p.name === hit[1].name)) picked.push(hit[1]);
  }
  return picked.slice(0, 8);
}

function isSecondaryVitaminRow(name, usedNames) {
  const l = name.toLowerCase();
  if (/added|carotene|tocopherol,\s*(beta|gamma|delta)|retinol|folic acid/.test(l)) {
    return true;
  }
  if (l.includes('international units') && [...usedNames].some((n) => n.toLowerCase().includes('vitamin d'))) {
    return true;
  }
  return false;
}

function pickVitamins(allRows) {
  const { picked, used } = pickByOrderedIds(allRows, VITAMIN_NUTRIENT_IDS);
  const extra = allRows
    .filter(
      (r) =>
        isVitaminName(r.name) &&
        !used.has(r.name) &&
        !isMineralName(r.name) &&
        !isSecondaryVitaminRow(r.name, used),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...picked, ...extra];
}

function pickMinerals(allRows, generalRows) {
  const generalNames = new Set(generalRows.map((g) => g.name));
  const { picked, used } = pickByOrderedIds(allRows, MINERAL_NUTRIENT_IDS);
  const extra = allRows
    .filter(
      (r) =>
        isMineralName(r.name) &&
        !isVitaminName(r.name) &&
        !generalNames.has(r.name) &&
        !used.has(r.name),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...picked, ...extra];
}

function buildCalorieBreakdown(fdcFood, macros) {
  const fromProtein = Math.round(macros.protein * 4 * 10) / 10;
  const fromCarbs = Math.round(macros.carbs * 4 * 10) / 10;
  const fromFat = Math.round(macros.fat * 9 * 10) / 10;
  const atwaterSum = fromProtein + fromCarbs + fromFat;
  let total = energyKcal(fdcFood);
  if (total == null || total <= 0) total = atwaterSum;
  else total = Math.round(total * 10) / 10;

  const denom = total > 0 ? total : 1;
  return {
    total,
    fromCarbs,
    fromFat,
    fromProtein,
    pctCarbs: Math.round((fromCarbs / denom) * 1000) / 10,
    pctFat: Math.round((fromFat / denom) * 1000) / 10,
    pctProtein: Math.round((fromProtein / denom) * 1000) / 10,
  };
}

function buildFoodDetails(fdcFood) {
  const macros = extractMacrosPer100g(fdcFood);
  const allNutrients = normalizeNutrientRows(fdcFood);
  const general = pickGeneralNutrients(allNutrients);
  const vitamins = pickVitamins(allNutrients);
  const minerals = pickMinerals(allNutrients, general);

  const brandOwner = fdcFood.brandOwner || null;
  const rawName = fdcFood.description || fdcFood.lowercaseDescription || 'Unknown food';

  return {
    fdcId: fdcFood.fdcId,
    name: sanitizeFoodName(rawName, { brandOwner }),
    dataType: fdcFood.dataType || null,
    foodCategory:
      formatFoodCategory(fdcFood.foodCategory) ||
      formatFoodCategory(fdcFood.brandedFoodCategory) ||
      null,
    servingSize: fdcFood.servingSize ?? null,
    servingSizeUnit: fdcFood.servingSizeUnit ?? null,
    per100g: true,
    macros,
    calories: buildCalorieBreakdown(fdcFood, macros),
    general,
    vitamins,
    minerals,
  };
}

module.exports = { buildFoodDetails, normalizeNutrientRows };
