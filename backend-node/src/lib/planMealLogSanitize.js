/**
 * Normalize plan-meal log payloads before Zod validation.
 * Handles stale localStorage drafts, null webtebId, category strings as role, etc.
 */
const VALID_ROLES = new Set(['protein', 'carb', 'fat', 'fruit', 'dairy', 'mixed']);

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function nonNegativeNumber(value, fallback = 0) {
  const n = finiteNumber(value);
  return n != null && n >= 0 ? n : fallback;
}

function positiveGrams(value) {
  const n = finiteNumber(value);
  if (n == null || n <= 0) return null;
  return Math.min(5000, n);
}

function sanitizeRole(role) {
  if (typeof role === 'string' && VALID_ROLES.has(role)) return role;
  return undefined;
}

function sanitizeWebtebId(value) {
  const n = finiteNumber(value);
  if (n == null || n <= 0) return undefined;
  return Math.trunc(n);
}

function sanitizeMacrosPer100(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  return {
    calories: nonNegativeNumber(raw.calories),
    protein: nonNegativeNumber(raw.protein),
    carbs: nonNegativeNumber(raw.carbs),
    fat: nonNegativeNumber(raw.fat),
  };
}

function sanitizePlanMealLogItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name ?? '').trim();
  const grams = positiveGrams(raw.grams);
  if (!name || !grams) return null;

  const item = {
    name: name.slice(0, 200),
    grams,
  };

  const role = sanitizeRole(raw.role);
  if (role) item.role = role;

  const webtebId = sanitizeWebtebId(raw.webtebId);
  if (webtebId) item.webtebId = webtebId;

  const macrosPer100 = sanitizeMacrosPer100(raw.macrosPer100);
  if (macrosPer100) item.macrosPer100 = macrosPer100;

  if (raw.calories != null) item.calories = nonNegativeNumber(raw.calories);
  if (raw.protein != null) item.protein = nonNegativeNumber(raw.protein);
  if (raw.carbs != null) item.carbs = nonNegativeNumber(raw.carbs);
  if (raw.fat != null) item.fat = nonNegativeNumber(raw.fat);

  if (raw.kitchenFood === true) item.kitchenFood = true;

  return item;
}

function sanitizePlanMealLogBody(raw) {
  if (!raw || typeof raw !== 'object') {
    return { slotId: '', items: [] };
  }

  const slotId = String(raw.slotId ?? '').trim().slice(0, 64);
  const items = Array.isArray(raw.items)
    ? raw.items.map(sanitizePlanMealLogItem).filter(Boolean).slice(0, 12)
    : [];

  const body = { slotId, items };
  if (typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date.trim())) {
    body.date = raw.date.trim();
  }
  return body;
}

module.exports = {
  sanitizePlanMealLogBody,
  sanitizePlanMealLogItem,
  VALID_PLAN_MEAL_ROLES: [...VALID_ROLES],
};
