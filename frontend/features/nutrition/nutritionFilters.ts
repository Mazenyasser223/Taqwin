import type { FdcFoodPreview, FoodSort } from '../../types';

export type MacroKey = 'protein' | 'calories' | 'carbs' | 'fat';
export type MacroSortDirection = 'off' | 'high' | 'low';

export type MacroAmountBounds = {
  /** أعلى — حد أدنى (g أو سعرات) */
  min: number | '';
  /** أقل — حد أقصى */
  max: number | '';
};

export interface NutritionFilterState {
  toggles: Record<MacroKey, MacroSortDirection>;
  amounts: Record<MacroKey, MacroAmountBounds>;
}

export const DEFAULT_NUTRITION_FILTERS: NutritionFilterState = {
  toggles: {
    protein: 'off',
    calories: 'off',
    carbs: 'off',
    fat: 'off',
  },
  amounts: {
    protein: { min: '', max: '' },
    calories: { min: '', max: '' },
    carbs: { min: '', max: '' },
    fat: { min: '', max: '' },
  },
};

const MACRO_ORDER: MacroKey[] = ['calories', 'carbs', 'protein', 'fat'];

const MACRO_SORT: Record<MacroKey, { high: FoodSort; low: FoodSort }> = {
  protein: { high: 'protein', low: 'proteinAsc' },
  calories: { high: 'caloriesDesc', low: 'calories' },
  carbs: { high: 'carbsDesc', low: 'carbs' },
  fat: { high: 'fatDesc', low: 'fat' },
};

const MACRO_BOUND_KEYS: Record<
  MacroKey,
  { min: 'minProtein' | 'minCalories' | 'minCarbs' | 'minFat'; max: 'maxProtein' | 'maxCalories' | 'maxCarbs' | 'maxFat' }
> = {
  protein: { min: 'minProtein', max: 'maxProtein' },
  calories: { min: 'minCalories', max: 'maxCalories' },
  carbs: { min: 'minCarbs', max: 'maxCarbs' },
  fat: { min: 'minFat', max: 'maxFat' },
};

/** Per-100g defaults when toggle is on but no custom amount. */
const MACRO_TOGGLE_BOUNDS: Record<
  MacroKey,
  {
    high: Partial<Record<'minProtein' | 'minCalories' | 'minCarbs' | 'minFat', number>>;
    low: Partial<Record<'maxProtein' | 'maxCalories' | 'maxCarbs' | 'maxFat', number>>;
  }
> = {
  protein: { high: { minProtein: 15 }, low: { maxProtein: 10 } },
  calories: { high: { minCalories: 150 }, low: { maxCalories: 120 } },
  carbs: { high: { minCarbs: 12 }, low: { maxCarbs: 10 } },
  fat: { high: { minFat: 12 }, low: { maxFat: 5 } },
};

export function getMacroDirection(filters: NutritionFilterState, macro: MacroKey): MacroSortDirection {
  return filters.toggles[macro] ?? 'off';
}

export function getMacroAmounts(filters: NutritionFilterState, macro: MacroKey): MacroAmountBounds {
  return filters.amounts[macro] ?? { min: '', max: '' };
}

function mergedBounds(filters: NutritionFilterState) {
  const bounds: Record<string, number> = {};

  for (const key of MACRO_ORDER) {
    const { min, max } = filters.amounts[key];
    const dir = filters.toggles[key];
    const keys = MACRO_BOUND_KEYS[key];

    if (max !== '') bounds[keys.max] = max;
    else if (dir === 'low') Object.assign(bounds, MACRO_TOGGLE_BOUNDS[key].low);

    if (min !== '') bounds[keys.min] = min;
    else if (dir === 'high') Object.assign(bounds, MACRO_TOGGLE_BOUNDS[key].high);
  }

  return bounds;
}

function sortKeysFromFilters(filters: NutritionFilterState): FoodSort[] {
  const keys: FoodSort[] = [];
  for (const macro of MACRO_ORDER) {
    const dir = filters.toggles[macro];
    const { min, max } = filters.amounts[macro];
    if (dir !== 'off') {
      keys.push(MACRO_SORT[macro][dir]);
      continue;
    }
    if (min !== '') keys.push(MACRO_SORT[macro].high);
    else if (max !== '') keys.push(MACRO_SORT[macro].low);
  }
  return keys;
}

function inRange(value: number, min: number | '', max: number | '') {
  if (min !== '' && value < min) return false;
  if (max !== '' && value > max) return false;
  return true;
}

export function applyNutritionFilters(
  foods: FdcFoodPreview[],
  filters: NutritionFilterState
): FdcFoodPreview[] {
  const b = mergedBounds(filters);
  const minProtein = b.minProtein ?? '';
  const maxProtein = b.maxProtein ?? '';
  const minCalories = b.minCalories ?? '';
  const maxCalories = b.maxCalories ?? '';
  const minCarbs = b.minCarbs ?? '';
  const maxCarbs = b.maxCarbs ?? '';
  const minFat = b.minFat ?? '';
  const maxFat = b.maxFat ?? '';

  let list = foods.filter((f) => {
    if (!inRange(f.protein, minProtein, maxProtein)) return false;
    if (!inRange(f.calories, minCalories, maxCalories)) return false;
    if (!inRange(f.carbs, minCarbs, maxCarbs)) return false;
    if (!inRange(f.fat, minFat, maxFat)) return false;
    return true;
  });

  const sorts = sortKeysFromFilters(filters);
  for (let i = sorts.length - 1; i >= 0; i--) {
    const sort = sorts[i];
    if (sort === 'protein') list = [...list].sort((a, b) => b.protein - a.protein);
    else if (sort === 'proteinAsc') list = [...list].sort((a, b) => a.protein - b.protein);
    else if (sort === 'calories') list = [...list].sort((a, b) => a.calories - b.calories);
    else if (sort === 'caloriesDesc') list = [...list].sort((a, b) => b.calories - a.calories);
    else if (sort === 'carbs') list = [...list].sort((a, b) => a.carbs - b.carbs);
    else if (sort === 'carbsDesc') list = [...list].sort((a, b) => b.carbs - a.carbs);
    else if (sort === 'fat') list = [...list].sort((a, b) => a.fat - b.fat);
    else if (sort === 'fatDesc') list = [...list].sort((a, b) => b.fat - a.fat);
  }

  if (sorts.length === 0) {
    list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  }

  return list;
}

function macroHasActiveFilter(filters: NutritionFilterState, macro: MacroKey): boolean {
  const { min, max } = filters.amounts[macro];
  return filters.toggles[macro] !== 'off' || min !== '' || max !== '';
}

export function countActiveFilters(filters: NutritionFilterState): number {
  return MACRO_ORDER.filter((k) => macroHasActiveFilter(filters, k)).length;
}

export function filtersEqual(a: NutritionFilterState, b: NutritionFilterState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Query params for GET /api/nutrition/webteb/search */
export function filtersToApiParams(filters: NutritionFilterState) {
  const b = mergedBounds(filters);
  const params: Record<string, string | number> = {};

  const addNum = (key: string, val: number | undefined) => {
    if (val != null) params[key] = val;
  };

  addNum('minProtein', b.minProtein);
  addNum('maxProtein', b.maxProtein);
  addNum('minCalories', b.minCalories);
  addNum('maxCalories', b.maxCalories);
  addNum('minCarbs', b.minCarbs);
  addNum('maxCarbs', b.maxCarbs);
  addNum('minFat', b.minFat);
  addNum('maxFat', b.maxFat);

  const sorts = sortKeysFromFilters(filters);
  if (sorts[0]) params.sort = sorts[0];
  if (sorts[1]) params.sort2 = sorts[1];

  return params;
}
