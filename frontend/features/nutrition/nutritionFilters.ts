import type { FdcFoodPreview, FoodSort } from '../../types';

export type DataTypeFilter = 'all' | 'foundation' | 'branded';

export type MacroPreset = 'none' | 'highProtein' | 'lowCal' | 'lowCarb' | 'keto' | 'lowFat';

export interface NutritionFilterState {
  minProtein: number | '';
  maxProtein: number | '';
  minCalories: number | '';
  maxCalories: number | '';
  minCarbs: number | '';
  maxCarbs: number | '';
  minFat: number | '';
  maxFat: number | '';
  brandQuery: string;
  macroPreset: MacroPreset;
  sort: FoodSort;
  dataType: DataTypeFilter;
}

export const DEFAULT_NUTRITION_FILTERS: NutritionFilterState = {
  minProtein: '',
  maxProtein: '',
  minCalories: '',
  maxCalories: '',
  minCarbs: '',
  maxCarbs: '',
  minFat: '',
  maxFat: '',
  brandQuery: '',
  macroPreset: 'none',
  sort: 'name',
  dataType: 'foundation',
};

const PRESET_RULES: Record<
  Exclude<MacroPreset, 'none'>,
  Partial<NutritionFilterState>
> = {
  highProtein: { minProtein: 15, maxCarbs: '', maxCalories: '' },
  lowCal: { maxCalories: 120, minProtein: '' },
  lowCarb: { maxCarbs: 10 },
  keto: { maxCarbs: 10, minFat: 15 },
  lowFat: { maxFat: 5 },
};

function inRange(value: number, min: number | '', max: number | '') {
  if (min !== '' && value < min) return false;
  if (max !== '' && value > max) return false;
  return true;
}

/** Effective bounds after applying an optional preset on top of manual fields. */
export function resolveFilterBounds(filters: NutritionFilterState) {
  const preset = filters.macroPreset !== 'none' ? PRESET_RULES[filters.macroPreset] : {};
  const pick = (key: keyof NutritionFilterState, manual: number | '') => {
    const fromPreset = preset[key];
    if (typeof fromPreset === 'number') return fromPreset;
    return manual;
  };

  return {
    minProtein: pick('minProtein', filters.minProtein),
    maxProtein: pick('maxProtein', filters.maxProtein),
    minCalories: pick('minCalories', filters.minCalories),
    maxCalories: pick('maxCalories', filters.maxCalories),
    minCarbs: pick('minCarbs', filters.minCarbs),
    maxCarbs: pick('maxCarbs', filters.maxCarbs),
    minFat: pick('minFat', filters.minFat),
    maxFat: pick('maxFat', filters.maxFat),
  };
}

export function applyNutritionFilters(
  foods: FdcFoodPreview[],
  filters: NutritionFilterState
): FdcFoodPreview[] {
  const b = resolveFilterBounds(filters);
  const brand = filters.brandQuery.trim().toLowerCase();

  let list = foods.filter((f) => {
    if (!inRange(f.protein, b.minProtein, b.maxProtein)) return false;
    if (!inRange(f.calories, b.minCalories, b.maxCalories)) return false;
    if (!inRange(f.carbs, b.minCarbs, b.maxCarbs)) return false;
    if (!inRange(f.fat, b.minFat, b.maxFat)) return false;
    if (brand) {
      const hay = `${f.brandOwner ?? ''} ${f.name}`.toLowerCase();
      if (!hay.includes(brand)) return false;
    }
    return true;
  });

  if (filters.sort === 'protein') {
    list = [...list].sort((a, b) => b.protein - a.protein);
  } else if (filters.sort === 'proteinAsc') {
    list = [...list].sort((a, b) => a.protein - b.protein);
  } else if (filters.sort === 'calories') {
    list = [...list].sort((a, b) => a.calories - b.calories);
  } else if (filters.sort === 'caloriesDesc') {
    list = [...list].sort((a, b) => b.calories - a.calories);
  } else if (filters.sort === 'carbs') {
    list = [...list].sort((a, b) => a.carbs - b.carbs);
  } else if (filters.sort === 'carbsDesc') {
    list = [...list].sort((a, b) => b.carbs - a.carbs);
  } else if (filters.sort === 'fat') {
    list = [...list].sort((a, b) => a.fat - b.fat);
  } else if (filters.sort === 'fatDesc') {
    list = [...list].sort((a, b) => b.fat - a.fat);
  } else if (filters.sort === 'proteinDensity') {
    list = [...list].sort(
      (a, b) => b.protein / Math.max(b.calories, 1) - a.protein / Math.max(a.calories, 1)
    );
  } else {
    list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  }

  return list;
}

export function countActiveFilters(filters: NutritionFilterState): number {
  let n = 0;
  if (filters.macroPreset !== 'none') n++;
  if (filters.brandQuery.trim()) n++;
  if (filters.sort !== 'name') n++;
  const keys: (keyof NutritionFilterState)[] = [
    'minProtein',
    'maxProtein',
    'minCalories',
    'maxCalories',
    'minCarbs',
    'maxCarbs',
    'minFat',
    'maxFat',
  ];
  for (const k of keys) {
    if (filters[k] !== '') n++;
  }
  return n;
}

export function filtersEqual(a: NutritionFilterState, b: NutritionFilterState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Query params sent to GET /api/nutrition/fdc/search (server applies filters on USDA results). */
export function filtersToApiParams(filters: NutritionFilterState) {
  const b = resolveFilterBounds(filters);
  const params: Record<string, string | number> = {};

  const addNum = (key: string, val: number | '') => {
    if (val !== '') params[key] = val;
  };

  addNum('minProtein', b.minProtein);
  addNum('maxProtein', b.maxProtein);
  addNum('minCalories', b.minCalories);
  addNum('maxCalories', b.maxCalories);
  addNum('minCarbs', b.minCarbs);
  addNum('maxCarbs', b.maxCarbs);
  addNum('minFat', b.minFat);
  addNum('maxFat', b.maxFat);

  if (filters.brandQuery.trim()) params.brandQuery = filters.brandQuery.trim();
  if (filters.macroPreset !== 'none') params.macroPreset = filters.macroPreset;
  if (filters.sort !== 'name') params.sort = filters.sort;

  return params;
}
