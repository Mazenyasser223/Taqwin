/**
 * Shared USDA FDC search + cache (used by routes and startup cache warming).
 */
const { prisma } = require('../db');
const fdc = require('../services/fdcService');
const translate = require('../services/translateService');
const fdcCache = require('./fdcCache');
const { getCategoryById } = require('./fdcCategories');
const { hasActiveFilters } = require('./nutritionFilterQuery');
const { resolveUserSearchQuery } = require('./nutritionSearchQuery');
const { filterFoodsByUserSearch } = require('./nutritionSearchMatch');

const CACHE_VERSION = 4;
const DEFAULT_PAGE_SIZE = 25;

async function buildFdcQuery({ q, categoryId }) {
  const rawQ = (q || '').trim();
  const cacheKey = `fdc:resolve:v2:${categoryId || ''}:${rawQ.toLowerCase()}`;
  return fdcCache.getOrFetch(
    cacheKey,
    async () => {
      const cat = categoryId ? getCategoryById(categoryId) : null;
      const userQ = rawQ
        ? await resolveUserSearchQuery(rawQ, { translateFn: translate.translateToEnglish })
        : '';
      if (!cat) return { fdcQuery: userQ || '*', rawQ, resolvedQ: userQ };
      if (userQ) return { fdcQuery: userQ, rawQ, resolvedQ: userQ };
      return { fdcQuery: cat.query, rawQ: '', resolvedQ: '' };
    },
    Number(process.env.FDC_RESOLVE_CACHE_TTL_MS) || 30 * 60 * 1000
  );
}

function buildFdcSearchCacheKey(query) {
  return JSON.stringify(query);
}

async function attachCachedIds(foods) {
  const fdcIds = foods.map((f) => f.fdcId);
  const cached = fdcIds.length
    ? await prisma.foodItem.findMany({
        where: { fdcId: { in: fdcIds } },
        select: { id: true, fdcId: true },
      })
    : [];
  const cachedByFdc = new Map(cached.map((c) => [c.fdcId, c.id]));
  return foods.map((f) => ({
    ...f,
    id: cachedByFdc.get(f.fdcId) ?? null,
    cached: cachedByFdc.has(f.fdcId),
  }));
}

/**
 * @param {object} opts
 * @param {string} [opts.q]
 * @param {string} [opts.categoryId]
 * @param {number} [opts.page]
 * @param {number} [opts.pageSize]
 * @param {'en'|'ar'} [opts.lang]
 * @param {number} [opts.usdaStartPage]
 * @param {object} [opts.filterQuery]
 * @param {string[]} [opts.dataTypes]
 */
async function searchFdcCached(opts = {}) {
  const {
    q,
    categoryId,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    lang = 'en',
    usdaStartPage = 1,
    filterQuery = {},
    dataTypes = fdc.DEFAULT_DATA_TYPES,
  } = opts;

  const allowedWholeFood = new Set(fdc.WHOLE_FOOD_DATA_TYPES);
  const resolvedDataTypes = (dataTypes || fdc.DEFAULT_DATA_TYPES).filter((t) =>
    allowedWholeFood.has(t)
  );
  const finalDataTypes = resolvedDataTypes.length > 0 ? resolvedDataTypes : fdc.DEFAULT_DATA_TYPES;

  const queryBundle = await buildFdcQuery({ q, categoryId });
  const { fdcQuery, resolvedQ } = queryBundle;
  const rawSearch = (q || '').trim();
  const filtersActive = hasActiveFilters(filterQuery);

  const baseCacheKey = buildFdcSearchCacheKey({
    v: CACHE_VERSION,
    q,
    categoryId,
    page,
    pageSize,
    dataType: finalDataTypes.join(','),
    usdaStartPage,
    fdcQuery,
    ...filterQuery,
  });

  const filteredTtl = Number(process.env.FDC_RESPONSE_CACHE_TTL_MS) || 5 * 60 * 1000;
  const plainTtl = Number(process.env.FDC_RESPONSE_PLAIN_CACHE_TTL_MS) || 15 * 60 * 1000;
  const cacheTtl = filtersActive ? filteredTtl : plainTtl;
  const arTtl = Number(process.env.FDC_AR_CACHE_TTL_MS) || plainTtl;

  const fetchUsdaPayload = async () => {
    const result = filtersActive
      ? await fdc.searchFoodsFiltered({
          query: fdcQuery,
          pageSize,
          filterQuery,
          dataType: finalDataTypes,
          usdaStartPage: Number(usdaStartPage) || 1,
        })
      : await (() => {
          const usdaPage = Number(usdaStartPage) || Number(page) || 1;
          return fdc.searchFoods({
            query: fdcQuery,
            pageNumber: usdaPage,
            pageSize,
            dataType: finalDataTypes,
          }).then((r) => ({
            foods: r.foods,
            totalHits: r.totalHits,
            nextUsdaPage: usdaPage + 1,
            hasMore: usdaPage * pageSize < r.totalHits,
          }));
        })();

    let foods = await attachCachedIds(result.foods);
    if (rawSearch) {
      foods = filterFoodsByUserSearch(foods, rawSearch, resolvedQ);
    }

    const hasMore = Boolean(result.hasMore) && (foods.length > 0 || !rawSearch);

    return {
      foods,
      totalHits: rawSearch ? foods.length : result.totalHits,
      currentPage: page,
      pageSize,
      categoryId: categoryId || null,
      nextUsdaPage: result.nextUsdaPage ?? page + 1,
      hasMore,
      filtersApplied: filtersActive,
      searchScoped: Boolean(rawSearch),
    };
  };

  const baseKey = `search:base:${baseCacheKey}`;
  const basePayload = await fdcCache.getOrFetch(baseKey, fetchUsdaPayload, cacheTtl);

  if (lang !== 'ar') return basePayload;

  return fdcCache.getOrFetch(
    `search:ar:v3:${baseCacheKey}`,
    async () => ({
      ...basePayload,
      foods: await translate.localizeFoodPreviews(basePayload.foods, 'ar'),
    }),
    arTtl
  );
}

module.exports = {
  searchFdcCached,
  buildFdcQuery,
  DEFAULT_PAGE_SIZE,
};
