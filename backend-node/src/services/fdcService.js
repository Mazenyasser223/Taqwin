/**
 * USDA FoodData Central (FDC) API client.
 * @see https://fdc.nal.usda.gov/api-guide.html
 */
const fdcCache = require('../lib/fdcCache');
const { applyFdcPreviewFilters } = require('../lib/nutritionFilterQuery');
const { normalizeFdcFoodRecord } = require('../lib/fdcFoodNormalize');

const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1';

const FILTER_PAGE_BATCH = Number(process.env.FDC_FILTER_PAGE_BATCH) || 2;
const FILTER_MAX_BATCHES = Number(process.env.FDC_FILTER_MAX_BATCHES) || 2;
const FILTERED_SCAN_TTL_MS = Number(process.env.FDC_FILTERED_CACHE_TTL_MS) || 5 * 60 * 1000;

const NUTRIENT = {
  ENERGY_KCAL: 1008,
  ENERGY_KJ: 2047,
  ENERGY_ATWATER_GENERAL: 2047,
  ENERGY_ATWATER_SPECIFIC: 2048,
  PROTEIN: 1003,
  CARBS: 1005,
  FAT: 1004,
  STARCH: 1009,
  SUGARS: 2000,
  FIBER: 1079,
};

const NUTRIENT_NUM = {
  PROTEIN: '203',
  FAT: '204',
  CARBS: '205',
  ENERGY: '208',
  STARCH: '209',
};

const DEFAULT_DATA_TYPES = ['SR Legacy', 'Foundation'];
const WHOLE_FOOD_DATA_TYPES = DEFAULT_DATA_TYPES;

function getApiKey() {
  const key = process.env.USDA_FDC_API_KEY;
  if (!key) throw new Error('USDA_FDC_API_KEY is not configured');
  return key;
}

function isConfigured() {
  return Boolean(process.env.USDA_FDC_API_KEY?.trim());
}

function findNutrient(food, nutrientId) {
  return (food.foodNutrients || []).find(
    (n) => n.nutrient?.id === nutrientId || n.nutrientId === nutrientId
  );
}

function findNutrientByNumber(food, nutrientNumber) {
  const num = String(nutrientNumber);
  return (food.foodNutrients || []).find(
    (n) => n.nutrient?.number === num || n.nutrientNumber === num || n.number === num
  );
}

function readNutrientValue(hit) {
  if (!hit) return null;
  const v = hit.amount ?? hit.value;
  if (v == null || Number.isNaN(Number(v))) return null;
  return Number(v);
}

function nutrientAmount(food, nutrientId) {
  return readNutrientValue(findNutrient(food, nutrientId));
}

function nutrientAmountByNumber(food, nutrientNumber) {
  return readNutrientValue(findNutrientByNumber(food, nutrientNumber));
}

function firstNutrient(food, ids, numbers) {
  for (const id of ids) {
    const v = nutrientAmount(food, id);
    if (v != null) return v;
  }
  for (const num of numbers) {
    const v = nutrientAmountByNumber(food, num);
    if (v != null) return v;
  }
  return null;
}

function nutrientUnit(food, nutrientId) {
  const hit = findNutrient(food, nutrientId);
  if (!hit) return '';
  return String(hit.nutrient?.unitName || hit.unitName || '').toLowerCase();
}

function labelAmount(food, key) {
  const v = food.labelNutrients?.[key]?.value;
  if (v == null || Number.isNaN(Number(v))) return null;
  return Number(v);
}

function servingGrams(food) {
  if (food.servingSize && String(food.servingSizeUnit || '').toLowerCase() === 'g') {
    return Number(food.servingSize);
  }
  const portion = food.foodPortions?.find((p) => p.gramWeight > 0);
  if (portion?.gramWeight) return Number(portion.gramWeight);
  return 100;
}

function estimateCalories(protein, carbs, fat) {
  return Math.max(0, 4 * protein + 4 * carbs + 9 * fat);
}

function energyKcal(food) {
  const fromLabel = labelAmount(food, 'calories');
  if (fromLabel != null && fromLabel > 0) return fromLabel;

  const kcal1008 = nutrientAmount(food, NUTRIENT.ENERGY_KCAL);
  if (kcal1008 != null && kcal1008 > 0) return kcal1008;

  for (const id of [NUTRIENT.ENERGY_ATWATER_SPECIFIC, NUTRIENT.ENERGY_ATWATER_GENERAL]) {
    const val = nutrientAmount(food, id);
    if (val == null || val <= 0) continue;
    const unit = nutrientUnit(food, id);
    if (unit.includes('kj')) return val / 4.184;
    return val;
  }

  return null;
}

function scaleToPer100g(value, grams) {
  if (grams > 0 && Math.abs(grams - 100) > 0.5) {
    return value * (100 / grams);
  }
  return value;
}

function extractCarbs(food) {
  let carbs = firstNutrient(food, [NUTRIENT.CARBS, 1050, 1072], [NUTRIENT_NUM.CARBS]);
  if (carbs != null && carbs >= 0) return carbs;

  const starch = firstNutrient(food, [NUTRIENT.STARCH], [NUTRIENT_NUM.STARCH]);
  const sugars = nutrientAmount(food, NUTRIENT.SUGARS) ?? labelAmount(food, 'sugars');
  if (starch != null || sugars != null) {
    return Math.max(0, (starch ?? 0) + (sugars ?? 0));
  }

  const fromLabel = labelAmount(food, 'carbohydrates');
  if (fromLabel != null) return Math.max(0, fromLabel);

  return 0;
}

function extractMacrosPer100g(food) {
  let protein =
    firstNutrient(food, [NUTRIENT.PROTEIN], [NUTRIENT_NUM.PROTEIN]) ??
    labelAmount(food, 'protein') ??
    0;
  let fat =
    firstNutrient(food, [NUTRIENT.FAT], [NUTRIENT_NUM.FAT]) ?? labelAmount(food, 'fat') ?? 0;

  let carbs = extractCarbs(food);

  let calories = energyKcal(food);

  const grams = servingGrams(food);
  const isBranded = food.dataType === 'Branded';

  if (isBranded && grams > 0 && grams !== 100) {
    protein = scaleToPer100g(protein, grams);
    carbs = scaleToPer100g(carbs, grams);
    fat = scaleToPer100g(fat, grams);
    if (calories != null) calories = scaleToPer100g(calories, grams);
  }

  protein = Math.max(0, protein);
  carbs = Math.max(0, carbs);
  fat = Math.max(0, fat);

  const atwater = estimateCalories(protein, carbs, fat);
  if (calories == null || calories <= 0) {
    calories = atwater;
  } else if (atwater > 0 && calories < atwater * 0.65) {
    calories = atwater;
  }

  return {
    calories: Math.round(calories),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
  };
}

function inferCategory(macros) {
  const { protein, carbs, fat } = macros;
  const total = protein + carbs + fat;
  if (total <= 0) return 'Veggie';
  if (protein / total >= 0.35) return 'Protein';
  if (carbs / total >= 0.5) return 'Carb';
  if (fat / total >= 0.4) return 'Fat';
  return 'Veggie';
}

function formatFoodCategory(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === 'object') {
    const fromObj = value.description || value.name;
    if (typeof fromObj === 'string' && fromObj.trim()) return fromObj.trim();
  }
  return null;
}

function toPreview(food) {
  const macros = extractMacrosPer100g(food);
  if (food.dataType === 'Branded' || (food.brandOwner && String(food.brandOwner).trim())) {
    return null;
  }

  return {
    fdcId: food.fdcId,
    name: food.description || food.lowercaseDescription || 'Unknown food',
    dataType: food.dataType || null,
    brandOwner: food.brandOwner || null,
    foodCategory:
      formatFoodCategory(food.foodCategory) || formatFoodCategory(food.brandedFoodCategory) || null,
    ...macros,
  };
}

async function fdcFetch(path, options = {}) {
  const url = new URL(`${FDC_BASE}${path}`);
  url.searchParams.set('api_key', getApiKey());
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`FDC API ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function mapRawFoodsToPreviews(rawFoods) {
  const foods = [];
  for (const food of rawFoods) {
    const preview = toPreview(food);
    if (
      preview &&
      (preview.calories > 0 || preview.protein > 0 || preview.carbs > 0 || preview.fat > 0)
    ) {
      foods.push(preview);
    }
  }
  return foods;
}

async function fetchUsdaSearchPage({ query, pageSize = 50, pageNumber = 1, dataType = DEFAULT_DATA_TYPES }) {
  const q = (query || '').trim() || '*';
  const types = [...dataType].sort().join(',');
  const cacheKey = `fdc:page:${q}:${pageNumber}:${pageSize}:${types}`;

  return fdcCache.getOrFetch(cacheKey, async () => {
    const body = {
      query: q,
      pageSize: Math.min(Math.max(pageSize, 1), 50),
      pageNumber,
      dataType,
      sortBy: 'dataType.keyword',
      sortOrder: 'asc',
    };
    const url = new URL(`${FDC_BASE}/foods/search`);
    url.searchParams.set('api_key', getApiKey());
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`FDC search ${res.status}: ${text.slice(0, 200)}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    const rawFoods = (data.foods || [])
      .filter((f) => f.dataType !== 'Branded' && !(f.brandOwner && String(f.brandOwner).trim()))
      .map(normalizeFdcFoodRecord);
    const foods = mapRawFoodsToPreviews(rawFoods);
    return {
      foods,
      totalHits: data.totalHits ?? foods.length,
      currentPage: data.currentPage ?? pageNumber,
      pageSize: data.pageSize ?? pageSize,
    };
  });
}

async function searchFoods({ query, pageSize = 50, pageNumber = 1, dataType = DEFAULT_DATA_TYPES }) {
  return fetchUsdaSearchPage({ query, pageSize, pageNumber, dataType });
}

async function searchFoodsFiltered({
  query,
  pageSize = 50,
  filterQuery,
  dataType = DEFAULT_DATA_TYPES,
  usdaStartPage = 1,
}) {
  const filterKey = JSON.stringify(filterQuery);
  const types = [...dataType].sort().join(',');
  const q = (query || '').trim() || '*';
  const scanCacheKey = `fdc:filtered:${q}:${types}:${usdaStartPage}:${pageSize}:${filterKey}`;

  return fdcCache.getOrFetch(
    scanCacheKey,
    async () => {
      const collected = [];
      let totalHits = 0;
      let page = usdaStartPage;
      let exhausted = false;

      for (let batch = 0; batch < FILTER_MAX_BATCHES && collected.length < pageSize && !exhausted; batch++) {
        const pageNumbers = Array.from({ length: FILTER_PAGE_BATCH }, (_, i) => page + i);
        page += FILTER_PAGE_BATCH;

        const pages = await Promise.all(
          pageNumbers.map((pageNumber) =>
            fetchUsdaSearchPage({ query, pageNumber, pageSize: 50, dataType })
          )
        );

        for (const result of pages) {
          totalHits = Math.max(totalHits, result.totalHits);
          if (result.currentPage * 50 >= result.totalHits) exhausted = true;
          collected.push(...applyFdcPreviewFilters(result.foods, filterQuery));
        }
      }

      return {
        foods: collected.slice(0, pageSize),
        totalHits,
        nextUsdaPage: page,
        hasMore: !exhausted && page * 50 < totalHits,
      };
    },
    FILTERED_SCAN_TTL_MS
  );
}

async function getFoodByFdcId(fdcId) {
  const cacheKey = `fdc:food:${fdcId}`;
  return fdcCache.getOrFetch(cacheKey, async () => {
    try {
      const abridged = await fdcFetch(`/food/${fdcId}?format=abridged`);
      const normalized = normalizeFdcFoodRecord(abridged);
      if ((normalized.foodNutrients || []).length > 0) return normalized;
    } catch (err) {
      if (err.status !== 404) throw err;
    }

    try {
      const full = await fdcFetch(`/food/${fdcId}`);
      return normalizeFdcFoodRecord(full);
    } catch (err) {
      if (err.status === 404) {
        const notFound = new Error('Food not found');
        notFound.status = 404;
        throw notFound;
      }
      throw err;
    }
  });
}

function toFoodItemFields(fdcFood) {
  const macros = extractMacrosPer100g(fdcFood);
  const usdaCat =
    formatFoodCategory(fdcFood.foodCategory) || formatFoodCategory(fdcFood.brandedFoodCategory);
  return {
    fdcId: fdcFood.fdcId,
    name: fdcFood.description || 'Unknown food',
    category: usdaCat || inferCategory(macros),
    ...macros,
    imageUrl: null,
    isPublic: true,
  };
}

module.exports = {
  searchFoods,
  searchFoodsFiltered,
  getFoodByFdcId,
  toPreview,
  toFoodItemFields,
  extractMacrosPer100g,
  energyKcal,
  formatFoodCategory,
  inferCategory,
  nutrientAmount,
  DEFAULT_DATA_TYPES,
  WHOLE_FOOD_DATA_TYPES,
  isConfigured,
};
