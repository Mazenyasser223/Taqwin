/**
 * WebTeb food search from local PostgreSQL (post-import).
 */
const { prisma } = require('../db');
const { resolveBounds, applyNutritionPreviewFilters } = require('./nutritionFilterQuery');
const { taqwinIdForSlug, isExcludedWebtebSlug, isKnownBrowseCategoryId, resolveCategoryId, dbCategoryIdsForBrowseId } = require('./webtebCategories');
const { loadPhotoWebtebIds, usesDefaultNameSort } = require('./nutritionFoodPhotos');
const DEFAULT_PAGE_SIZE = 25;
let cachedTotalInDb = null;
const MAX_PAGE_SIZE = 50;

function toPositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

function toPreview(food, categoryNameAr, foodItemId) {
  return {
    source: 'webteb',
    webtebId: food.webtebId,
    fdcId: 0,
    name: food.nameAr,
    nameEn: food.nameEn || null,
    dataType: 'WebTeb',
    brandOwner: null,
    categoryId: food.categoryId || null,
    foodCategory: categoryNameAr || food.categorySlug,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    id: foodItemId ?? null,
    cached: Boolean(foodItemId),
  };
}

function buildWebtebWhere({ categoryId, q, filterQuery = {} }) {
  const conditions = [];
  if (categoryId) {
    const ids = dbCategoryIdsForBrowseId(categoryId);
    conditions.push(ids.length === 1 ? { categoryId: ids[0] } : { categoryId: { in: ids } });
  }

  const rawQ = (q || '').trim();
  if (rawQ) {
    const terms = rawQ.split(/\s+/).filter(Boolean);
    const preferEn = /[a-zA-Z]/.test(rawQ) && !/[\u0600-\u06FF]/.test(rawQ);
    const termClause = (term) => {
      if (preferEn) {
        return {
          OR: [
            { nameEn: { contains: term, mode: 'insensitive' } },
            { nameAr: { contains: term, mode: 'insensitive' } },
          ],
        };
      }
      return { nameAr: { contains: term, mode: 'insensitive' } };
    };
    if (terms.length === 1) {
      conditions.push(termClause(terms[0]));
    } else if (terms.length > 1) {
      conditions.push({
        AND: terms.map((term) => termClause(term)),
      });
    }
  }

  const b = resolveBounds(filterQuery);
  const range = (field, min, max) => {
    const clause = {};
    if (min !== '') clause.gte = min;
    if (max !== '') clause.lte = max;
    if (Object.keys(clause).length > 0) conditions.push({ [field]: clause });
  };
  range('protein', b.minProtein, b.maxProtein);
  range('calories', b.minCalories, b.maxCalories);
  range('carbs', b.minCarbs, b.maxCarbs);
  range('fat', b.minFat, b.maxFat);

  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0];
  return { AND: conditions };
}

function sortToOrderClause(sort) {
  switch (sort) {
    case 'protein':
      return { protein: 'desc' };
    case 'proteinAsc':
      return { protein: 'asc' };
    case 'calories':
      return { calories: 'asc' };
    case 'caloriesDesc':
      return { calories: 'desc' };
    case 'carbs':
      return { carbs: 'asc' };
    case 'carbsDesc':
      return { carbs: 'desc' };
    case 'fat':
      return { fat: 'asc' };
    case 'fatDesc':
      return { fat: 'desc' };
    default:
      return { nameAr: 'asc' };
  }
}

function buildWebtebOrderBy(filterQuery = {}) {
  const primary = filterQuery.sort || 'name';
  const secondary = filterQuery.sort2;
  const clauses = [];
  if (primary && primary !== 'name') clauses.push(sortToOrderClause(primary));
  if (secondary && secondary !== 'name') clauses.push(sortToOrderClause(secondary));
  if (clauses.length === 0) return { nameAr: 'asc' };
  if (clauses.length === 1) return clauses[0];
  return clauses;
}

async function attachCachedIds(foods) {
  const ids = foods.map((f) => f.webtebId);
  const cached = ids.length
    ? await prisma.foodItem.findMany({
        where: { webtebId: { in: ids } },
        select: { id: true, webtebId: true },
      })
    : [];
  const byWebteb = new Map(cached.map((c) => [c.webtebId, c.id]));
  return foods.map((f) => ({
    ...f,
    id: byWebteb.get(f.webtebId) ?? null,
    cached: byWebteb.has(f.webtebId),
  }));
}

async function fetchWebtebPageRows({ where, orderBy, skip, take, photoFirst }) {
  if (!photoFirst) {
    return prisma.webtebFood.findMany({
      where,
      include: { category: true },
      orderBy,
      skip,
      take,
    });
  }

  const photoIds = loadPhotoWebtebIds();
  if (!photoIds.length) {
    return prisma.webtebFood.findMany({
      where,
      include: { category: true },
      orderBy,
      skip,
      take,
    });
  }

  const photoWhere = { AND: [where, { webtebId: { in: photoIds } }] };
  const noPhotoWhere = { AND: [where, { webtebId: { notIn: photoIds } }] };
  const photoCount = await prisma.webtebFood.count({ where: photoWhere });

  let rows = [];
  if (skip < photoCount) {
    const photoTake = Math.min(take, photoCount - skip);
    rows = await prisma.webtebFood.findMany({
      where: photoWhere,
      include: { category: true },
      orderBy,
      skip,
      take: photoTake,
    });
    if (rows.length < take) {
      const extra = await prisma.webtebFood.findMany({
        where: noPhotoWhere,
        include: { category: true },
        orderBy,
        skip: 0,
        take: take - rows.length,
      });
      rows = rows.concat(extra);
    }
  } else {
    rows = await prisma.webtebFood.findMany({
      where: noPhotoWhere,
      include: { category: true },
      orderBy,
      skip: skip - photoCount,
      take,
    });
  }
  return rows;
}

/**
 * @param {object} opts
 */
async function searchWebteb(opts = {}) {
  const { q, categoryId: rawCategoryId, filterQuery = {} } = opts;
  const categoryId = rawCategoryId ? resolveCategoryId(taqwinIdForSlug(rawCategoryId) || rawCategoryId) : undefined;
  const page = toPositiveInt(opts.page, 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, toPositiveInt(opts.pageSize, DEFAULT_PAGE_SIZE));

  if (cachedTotalInDb == null) {
    cachedTotalInDb = await prisma.webtebFood.count();
  }
  const totalInDb = cachedTotalInDb;
  if (totalInDb === 0) {
    return {
      foods: [],
      totalHits: 0,
      currentPage: page,
      pageSize,
      categoryId: categoryId || null,
      hasMore: false,
      source: 'webteb',
      emptyDatabase: true,
    };
  }

  const rawQ = (q || '').trim();
  if (!rawQ && !categoryId) {
    return {
      foods: [],
      totalHits: 0,
      currentPage: page,
      pageSize,
      categoryId: null,
      hasMore: false,
      source: 'webteb',
      emptyDatabase: false,
    };
  }

  const where = buildWebtebWhere({ categoryId, q, filterQuery });
  const totalHits = await prisma.webtebFood.count({ where });
  const skip = (page - 1) * pageSize;
  const orderBy =
    filterQuery.sort === 'proteinDensity'
      ? { protein: 'desc' }
      : buildWebtebOrderBy(filterQuery);
  const photoFirst = usesDefaultNameSort(filterQuery);

  let rows = await fetchWebtebPageRows({
    where,
    orderBy,
    skip,
    take: pageSize,
    photoFirst,
  });

  let previews = rows.map((f) => toPreview(f, f.category?.nameAr, null));
  previews = await attachCachedIds(previews);

  if (filterQuery.sort === 'proteinDensity') {
    previews = applyNutritionPreviewFilters(previews, filterQuery, { source: 'webteb' });
  }

  return {
    foods: previews,
    totalHits,
    currentPage: page,
    pageSize,
    categoryId: categoryId || null,
    hasMore: skip + rows.length < totalHits,
    source: 'webteb',
    emptyDatabase: false,
  };
}

async function getWebtebCategories() {
  if (cachedTotalInDb == null) {
    cachedTotalInDb = await prisma.webtebFood.count();
  }
  const totalFoods = cachedTotalInDb;

  const rows = await prisma.webtebCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { foods: true } } },
  });
  let categories;
  if (rows.length > 0) {
    const byId = new Map();
    for (const c of rows) {
      if (c._count.foods <= 0 || isExcludedWebtebSlug(c.slug)) continue;
      const browseId = resolveCategoryId(taqwinIdForSlug(c.slug) || c.id);
      if (!isKnownBrowseCategoryId(browseId)) continue;
      const existing = byId.get(browseId);
      const entry = {
        id: browseId,
        query: c.slug,
        icon: c.icon,
        nameAr: c.nameAr,
        foodCount: c._count.foods,
        source: 'webteb',
      };
      if (!existing) {
        byId.set(browseId, entry);
      } else {
        existing.foodCount += entry.foodCount;
        if (entry.foodCount > (existing._peakCount ?? 0)) {
          existing.query = entry.query;
          existing.nameAr = entry.nameAr;
          existing._peakCount = entry.foodCount;
        }
      }
    }
    categories = [...byId.values()];
  } else {
    const { FDC_CATEGORIES } = require('./fdcCategories');
    categories = FDC_CATEGORIES.map((c) => ({ ...c, source: 'webteb', foodCount: 0 }));
  }
  return { categories, totalFoods };
}

module.exports = { searchWebteb, getWebtebCategories, toPreview, DEFAULT_PAGE_SIZE };
