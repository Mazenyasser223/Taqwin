/**
 * Food database client — FatSecret Platform API (fdcId = FatSecret food_id).
 * @see https://platform.fatsecret.com/docs/guides/authentication/oauth2
 */
const fdcCache = require('../lib/fdcCache');
const { applyFdcPreviewFilters } = require('../lib/nutritionFilterQuery');
const { sanitizeFoodName } = require('../lib/foodNameSanitize');
const { apiCall, asArray, isConfigured } = require('./fatsecretClient');
const {
  fatsecretFoodToFdcShape,
  previewMacrosFromSearchFood,
  buildFoodName,
  formatCategory,
} = require('../lib/fatsecretNormalize');

const FILTER_PAGE_BATCH = Number(process.env.FDC_FILTER_PAGE_BATCH) || 4;
const FILTER_MAX_BATCHES = Number(process.env.FDC_FILTER_MAX_BATCHES) || 3;
const FILTERED_SCAN_TTL_MS = Number(process.env.FDC_FILTERED_CACHE_TTL_MS) || 5 * 60 * 1000;

/** Kept for route compatibility — FatSecret uses Generic / Brand instead. */
const DEFAULT_DATA_TYPES = ['SR Legacy', 'Foundation'];
const WHOLE_FOOD_DATA_TYPES = DEFAULT_DATA_TYPES;

function requireConfigured() {
  if (!isConfigured()) {
    throw new Error('FATSECRET_CLIENT_ID / FATSECRET_CLIENT_SECRET is not configured');
  }
}

function findNutrient(food, nutrientId) {
  return (food.foodNutrients || []).find(
    (n) => n.nutrient?.id === nutrientId || n.nutrientId === nutrientId
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

function labelAmount(food, key) {
  const v = food.labelNutrients?.[key]?.value;
  if (v == null || Number.isNaN(Number(v))) return null;
  return Number(v);
}

function estimateCalories(protein, carbs, fat) {
  return Math.max(0, 4 * protein + 4 * carbs + 9 * fat);
}

function energyKcal(food) {
  const fromLabel = labelAmount(food, 'calories');
  if (fromLabel != null && fromLabel > 0) return fromLabel;
  const hit = (food.foodNutrients || []).find((n) =>
    /energy/i.test(n.nutrient?.name || '')
  );
  const v = readNutrientValue(hit);
  return v != null && v > 0 ? v : null;
}

function extractMacrosPer100g(food) {
  const fromLabel = {
    protein: labelAmount(food, 'protein'),
    carbs: labelAmount(food, 'carbohydrates'),
    fat: labelAmount(food, 'fat'),
    calories: labelAmount(food, 'calories'),
  };
  let protein = fromLabel.protein ?? 0;
  let carbs = fromLabel.carbs ?? 0;
  let fat = fromLabel.fat ?? 0;
  let calories = fromLabel.calories ?? energyKcal(food);

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
  const macros =
    food.fdcId && food.labelNutrients
      ? extractMacrosPer100g(food)
      : previewMacrosFromSearchFood(food);
  const brandOwner = food.brandOwner || food.brand_name || null;
  const rawName = food.description || buildFoodName(food);
  const name = sanitizeFoodName(rawName, { brandOwner });
  const foodType = food.dataType || food.food_type;
  const skipBrand =
    foodType === 'Branded' || foodType === 'Brand' || (brandOwner && String(brandOwner).trim());
  if (skipBrand) return null;

  return {
    fdcId: Number(food.fdcId ?? food.food_id),
    name,
    dataType: foodType === 'Brand' ? 'Branded' : foodType || 'Foundation',
    brandOwner,
    foodCategory:
      formatFoodCategory(food.foodCategory) ||
      formatFoodCategory(food.brandedFoodCategory) ||
      formatCategory(food) ||
      null,
    ...macros,
  };
}

function mapSearchFoods(rawFoods) {
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

async function fetchSearchPage({ query, pageNumber = 1, pageSize = 50 }) {
  requireConfigured();
  const q = (query || '').trim() || '*';
  const maxResults = Math.min(Math.max(pageSize, 1), 50);
  const page = Math.max(0, pageNumber - 1);
  const cacheKey = `fs:page:${q}:${page}:${maxResults}`;

  return fdcCache.getOrFetch(cacheKey, async () => {
    const data = await apiCall('foods.search', {
      search_expression: q === '*' ? '' : q,
      page_number: String(page),
      max_results: String(maxResults),
    });

    const block = data.foods_search || data.foods || {};
    const rawFoods = asArray(block.food);
    const foods = mapSearchFoods(rawFoods);
    const totalHits = Number(block.total_results) || foods.length;

    return {
      foods,
      totalHits,
      currentPage: Number(block.page_number ?? page) + 1,
      pageSize: maxResults,
    };
  });
}

async function searchFoods({ query, pageSize = 50, pageNumber = 1 }) {
  return fetchSearchPage({ query, pageNumber, pageSize });
}

async function searchFoodsFiltered({
  query,
  pageSize = 50,
  filterQuery,
  usdaStartPage = 1,
}) {
  requireConfigured();
  const q = (query || '').trim() || '*';
  const filterKey = JSON.stringify(filterQuery);
  const scanCacheKey = `fs:filtered:${q}:${usdaStartPage}:${pageSize}:${filterKey}`;

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
          pageNumbers.map((pageNumber) => fetchSearchPage({ query, pageNumber, pageSize: 50 }))
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
  requireConfigured();
  const cacheKey = `fs:food:${fdcId}`;
  return fdcCache.getOrFetch(cacheKey, async () => {
    const data = await apiCall('food.get', { food_id: String(fdcId) });
    const food = data.food;
    if (!food) {
      const err = new Error('Food not found');
      err.status = 404;
      throw err;
    }
    return fatsecretFoodToFdcShape(food);
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
