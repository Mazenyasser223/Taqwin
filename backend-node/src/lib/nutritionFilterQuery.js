/**
 * Server-side macro / brand filters for USDA FDC search results (per 100g).
 */

const PRESET_RULES = {
  highProtein: { minProtein: 15 },
  lowCal: { maxCalories: 120 },
  lowCarb: { maxCarbs: 10 },
  keto: { maxCarbs: 10, minFat: 15 },
  lowFat: { maxFat: 5 },
};

function num(v) {
  if (v == null || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? n : '';
}

function resolveBounds(query) {
  const preset = query.macroPreset && query.macroPreset !== 'none' ? PRESET_RULES[query.macroPreset] : {};
  const pick = (key, manual) => {
    if (preset[key] != null) return preset[key];
    return num(manual);
  };

  return {
    minProtein: pick('minProtein', query.minProtein),
    maxProtein: pick('maxProtein', query.maxProtein),
    minCalories: pick('minCalories', query.minCalories),
    maxCalories: pick('maxCalories', query.maxCalories),
    minCarbs: pick('minCarbs', query.minCarbs),
    maxCarbs: pick('maxCarbs', query.maxCarbs),
    minFat: pick('minFat', query.minFat),
    maxFat: pick('maxFat', query.maxFat),
  };
}

function inRange(value, min, max) {
  if (min !== '' && value < min) return false;
  if (max !== '' && value > max) return false;
  return true;
}

/** Exclude packaged / company-branded products. */
function isWholeFood(f) {
  if (f.dataType === 'Branded') return false;
  if (f.brandOwner && String(f.brandOwner).trim()) return false;
  return true;
}

function applyFdcPreviewFilters(foods, query) {
  const b = resolveBounds(query);
  const brand = (query.brandQuery || '').trim().toLowerCase();
  const sort = query.sort || 'name';

  let list = foods.filter((f) => {
    if (!isWholeFood(f)) return false;
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

  if (sort === 'protein') list.sort((a, b) => b.protein - a.protein);
  else if (sort === 'proteinAsc') list.sort((a, b) => a.protein - b.protein);
  else if (sort === 'calories') list.sort((a, b) => a.calories - b.calories);
  else if (sort === 'caloriesDesc') list.sort((a, b) => b.calories - a.calories);
  else if (sort === 'carbs') list.sort((a, b) => a.carbs - b.carbs);
  else if (sort === 'carbsDesc') list.sort((a, b) => b.carbs - a.carbs);
  else if (sort === 'fat') list.sort((a, b) => a.fat - b.fat);
  else if (sort === 'fatDesc') list.sort((a, b) => b.fat - a.fat);
  else if (sort === 'proteinDensity') {
    list.sort((a, b) => b.protein / Math.max(b.calories, 1) - a.protein / Math.max(a.calories, 1));
  } else {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  return list;
}

function hasActiveFilters(query) {
  if ((query.brandQuery || '').trim()) return true;
  if (query.macroPreset && query.macroPreset !== 'none') return true;
  if (query.sort && query.sort !== 'name') return true;
  const keys = [
    'minProtein',
    'maxProtein',
    'minCalories',
    'maxCalories',
    'minCarbs',
    'maxCarbs',
    'minFat',
    'maxFat',
  ];
  return keys.some((k) => num(query[k]) !== '');
}

module.exports = { applyFdcPreviewFilters, hasActiveFilters, resolveBounds };
