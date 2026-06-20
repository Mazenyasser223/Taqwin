import type { PlanMealLogItem } from './nutritionService';

const VALID_ROLES = new Set<PlanMealLogItem['role']>([
  'protein',
  'carb',
  'fat',
  'fruit',
  'dairy',
  'mixed',
]);

function finiteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function nonNegativeNumber(value: unknown, fallback = 0): number {
  const n = finiteNumber(value);
  return n != null && n >= 0 ? n : fallback;
}

function positiveGrams(value: unknown): number | null {
  const n = finiteNumber(value);
  if (n == null || n <= 0) return null;
  return Math.min(5000, n);
}

function sanitizeRole(role: unknown): PlanMealLogItem['role'] | undefined {
  if (typeof role === 'string' && VALID_ROLES.has(role as PlanMealLogItem['role'])) {
    return role as PlanMealLogItem['role'];
  }
  return undefined;
}

function sanitizeWebtebId(value: unknown): number | undefined {
  const n = finiteNumber(value);
  if (n == null || n <= 0) return undefined;
  return Math.trunc(n);
}

function sanitizeMacrosPer100(raw: unknown): PlanMealLogItem['macrosPer100'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const m = raw as Record<string, unknown>;
  return {
    calories: nonNegativeNumber(m.calories),
    protein: nonNegativeNumber(m.protein),
    carbs: nonNegativeNumber(m.carbs),
    fat: nonNegativeNumber(m.fat),
  };
}

/** Coerce draft / cached meal items into a payload the API will accept. */
export function sanitizePlanMealLogItem(raw: unknown): PlanMealLogItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const name = String(item.name ?? '').trim();
  const grams = positiveGrams(item.grams);
  if (!name || !grams) return null;

  const out: PlanMealLogItem = {
    name: name.slice(0, 200),
    grams,
  };

  const role = sanitizeRole(item.role);
  if (role) out.role = role;

  const webtebId = sanitizeWebtebId(item.webtebId);
  if (webtebId) out.webtebId = webtebId;

  const macrosPer100 = sanitizeMacrosPer100(item.macrosPer100);
  if (macrosPer100) out.macrosPer100 = macrosPer100;

  if (item.calories != null) out.calories = nonNegativeNumber(item.calories);
  if (item.protein != null) out.protein = nonNegativeNumber(item.protein);
  if (item.carbs != null) out.carbs = nonNegativeNumber(item.carbs);
  if (item.fat != null) out.fat = nonNegativeNumber(item.fat);

  if (item.kitchenFood === true) out.kitchenFood = true;

  return out;
}

export function sanitizePlanMealLogItems(items: PlanMealLogItem[]): PlanMealLogItem[] {
  return items.map((item) => sanitizePlanMealLogItem(item)).filter((item): item is PlanMealLogItem => item != null);
}
