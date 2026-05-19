/**
 * Nutrition routes — food library, USDA FDC search, food logging, daily summaries.
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const fdc = require('../services/fdcService');
const translate = require('../services/translateService');
const fdcCache = require('../lib/fdcCache');
const { FDC_CATEGORIES, getCategoryById } = require('../lib/fdcCategories');
const { hasActiveFilters } = require('../lib/nutritionFilterQuery');

const router = express.Router();
router.use(authMiddleware);

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const searchSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    category: z.string().optional(),
    minProtein: z.coerce.number().min(0).optional(),
    maxCalories: z.coerce.number().min(0).optional(),
    minCalories: z.coerce.number().min(0).optional(),
    maxCarbs: z.coerce.number().min(0).optional(),
    sort: z.enum(['name', 'protein', 'calories', 'proteinDensity']).optional(),
  }),
});

const fdcSearchSchema = z.object({
  query: z
    .object({
      q: z.string().max(200).optional(),
      categoryId: z.string().max(64).optional(),
      page: z.coerce.number().int().min(1).optional(),
      pageSize: z.coerce.number().int().min(1).max(50).optional(),
      dataType: z.string().optional(),
      lang: z.enum(['en', 'ar']).optional(),
      usdaStartPage: z.coerce.number().int().min(1).optional(),
      minProtein: z.coerce.number().min(0).optional(),
      maxProtein: z.coerce.number().min(0).optional(),
      minCalories: z.coerce.number().min(0).optional(),
      maxCalories: z.coerce.number().min(0).optional(),
      minCarbs: z.coerce.number().min(0).optional(),
      maxCarbs: z.coerce.number().min(0).optional(),
      minFat: z.coerce.number().min(0).optional(),
      maxFat: z.coerce.number().min(0).optional(),
      brandQuery: z.string().max(120).optional(),
      macroPreset: z.enum(['none', 'highProtein', 'lowCal', 'lowCarb', 'keto', 'lowFat']).optional(),
      sort: z
        .enum([
          'name',
          'protein',
          'proteinAsc',
          'calories',
          'caloriesDesc',
          'carbs',
          'carbsDesc',
          'fat',
          'fatDesc',
          'proteinDensity',
        ])
        .optional(),
    })
    .refine((v) => (v.q && v.q.trim().length > 0) || v.categoryId, {
      message: 'Provide q or categoryId',
    }),
});

const fdcImportSchema = z.object({
  body: z.object({
    fdcId: z.number().int().positive(),
  }),
});

const dateSchema = z.object({
  query: z.object({
    date: dateOnly.optional(),
  }),
});

const logCreateSchema = z.object({
  body: z.object({
    foodItemId: z.string().uuid(),
    grams: z.number().positive().max(5000),
    loggedAt: z.string().datetime().optional(),
  }),
});

const idParam = z.object({ params: z.object({ id: z.string().uuid() }) });

function dayBounds(dateStr) {
  const start = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : new Date(new Date().setUTCHours(0, 0, 0, 0));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function applyMacroFilters(items, query) {
  let list = items;
  const { minProtein, maxCalories, minCalories, maxCarbs } = query;
  if (minProtein != null) list = list.filter((i) => i.protein >= minProtein);
  if (maxCalories != null) list = list.filter((i) => i.calories <= maxCalories);
  if (minCalories != null) list = list.filter((i) => i.calories >= minCalories);
  if (maxCarbs != null) list = list.filter((i) => i.carbs <= maxCarbs);
  if (query.sort === 'protein') list = [...list].sort((a, b) => b.protein - a.protein);
  else if (query.sort === 'calories') list = [...list].sort((a, b) => a.calories - b.calories);
  else if (query.sort === 'proteinDensity') {
    list = [...list].sort((a, b) => b.protein / Math.max(b.calories, 1) - a.protein / Math.max(a.calories, 1));
  }
  return list;
}

function buildFdcQuery({ q, categoryId }) {
  const cat = categoryId ? getCategoryById(categoryId) : null;
  if (!cat) return (q || '').trim() || '*';
  const userQ = (q || '').trim();
  return userQ ? `${cat.query} ${userQ}` : cat.query;
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

router.get('/fdc/categories', (_req, res) => {
  res.json({ categories: FDC_CATEGORIES });
});

router.get('/fdc/search', validate(fdcSearchSchema), async (req, res, next) => {
  try {
    const {
      q,
      categoryId,
      page = 1,
      pageSize = 50,
      dataType,
      lang,
      usdaStartPage = 1,
      sort,
      macroPreset,
      brandQuery,
      minProtein,
      maxProtein,
      minCalories,
      maxCalories,
      minCarbs,
      maxCarbs,
      minFat,
      maxFat,
    } = req.query;

    const allowedWholeFood = new Set(fdc.WHOLE_FOOD_DATA_TYPES);
    const dataTypes = (dataType
      ? dataType.split(',').map((s) => s.trim()).filter(Boolean)
      : fdc.DEFAULT_DATA_TYPES
    ).filter((t) => allowedWholeFood.has(t));
    const resolvedDataTypes = dataTypes.length > 0 ? dataTypes : fdc.DEFAULT_DATA_TYPES;

    const filterQuery = {
      sort,
      macroPreset,
      brandQuery,
      minProtein,
      maxProtein,
      minCalories,
      maxCalories,
      minCarbs,
      maxCarbs,
      minFat,
      maxFat,
    };

    const fdcQuery = buildFdcQuery({ q, categoryId });
    const filtersActive = hasActiveFilters(filterQuery);

    const cacheKey = buildFdcSearchCacheKey({
      q,
      categoryId,
      page,
      pageSize,
      dataType: resolvedDataTypes.join(','),
      lang,
      usdaStartPage,
      ...filterQuery,
    });
    const filteredTtl = Number(process.env.FDC_RESPONSE_CACHE_TTL_MS) || 5 * 60 * 1000;
    const plainTtl = Number(process.env.FDC_RESPONSE_PLAIN_CACHE_TTL_MS) || 15 * 60 * 1000;
    const cacheTtl = filtersActive ? filteredTtl : plainTtl;

    const payload = await fdcCache.getOrFetch(
      cacheKey,
      async () => {
        const result = filtersActive
          ? await fdc.searchFoodsFiltered({
              query: fdcQuery,
              pageSize,
              filterQuery,
              dataType: resolvedDataTypes,
              usdaStartPage: Number(usdaStartPage) || 1,
            })
          : await fdc.searchFoods({
              query: fdcQuery,
              pageNumber: page,
              pageSize,
              dataType: resolvedDataTypes,
            }).then((r) => ({
              foods: r.foods,
              totalHits: r.totalHits,
              nextUsdaPage: page + 1,
              hasMore: page * pageSize < r.totalHits,
            }));

        let foods = await attachCachedIds(result.foods);
        if (lang === 'ar') {
          foods = await translate.localizeFoodPreviews(foods, 'ar');
        }

        return {
          foods,
          totalHits: result.totalHits,
          currentPage: page,
          pageSize,
          categoryId: categoryId || null,
          nextUsdaPage: result.nextUsdaPage ?? page + 1,
          hasMore: result.hasMore ?? page * pageSize < result.totalHits,
          filtersApplied: filtersActive,
        };
      },
      cacheTtl
    );

    res.json(payload);
  } catch (err) {
    if (err.status === 403 || err.status === 429) {
      return res.status(503).json({ error: 'USDA food database is temporarily unavailable. Try again shortly.' });
    }
    if (err.message?.includes('USDA_FDC_API_KEY')) {
      return res.status(503).json({ error: 'Nutrition search is not configured on the server.' });
    }
    next(err);
  }
});

router.post('/fdc/import', validate(fdcImportSchema), async (req, res, next) => {
  try {
    const { fdcId } = req.body;
    const existing = await prisma.foodItem.findUnique({ where: { fdcId } });
    if (existing) return res.json(existing);

    const fdcFood = await fdc.getFoodByFdcId(fdcId);
    const fields = fdc.toFoodItemFields(fdcFood);
    const item = await prisma.foodItem.create({ data: fields });
    res.status(201).json(item);
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: 'Food not found in USDA database' });
    next(err);
  }
});

router.get('/foods', validate(searchSchema), async (req, res, next) => {
  try {
    const { search, category } = req.query;
    const where = { isPublic: true };
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (category) where.category = category;
    let items = await prisma.foodItem.findMany({ where, orderBy: { name: 'asc' }, take: 500 });
    items = applyMacroFilters(items, req.query);
    if (!req.query.sort || req.query.sort === 'name') {
      items = [...items].sort((a, b) => a.name.localeCompare(b.name));
    }
    res.json(items.slice(0, 200));
  } catch (err) {
    next(err);
  }
});

router.get('/foods/:id', validate(idParam), async (req, res, next) => {
  try {
    const item = await prisma.foodItem.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Food item not found' });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

router.post('/logs', validate(logCreateSchema), async (req, res, next) => {
  try {
    const food = await prisma.foodItem.findUnique({ where: { id: req.body.foodItemId } });
    if (!food) return res.status(404).json({ error: 'Food item not found' });
    const log = await prisma.foodLog.create({
      data: {
        userId: req.user.id,
        foodItemId: req.body.foodItemId,
        grams: req.body.grams,
        loggedAt: req.body.loggedAt ? new Date(req.body.loggedAt) : undefined,
      },
      include: { foodItem: true },
    });
    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
});

router.get('/logs/me', validate(dateSchema), async (req, res, next) => {
  try {
    const where = { userId: req.user.id };
    if (req.query.date) {
      const { start, end } = dayBounds(req.query.date);
      where.loggedAt = { gte: start, lt: end };
    }
    const logs = await prisma.foodLog.findMany({
      where,
      include: { foodItem: true },
      orderBy: { loggedAt: 'desc' },
      take: 200,
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

router.delete('/logs/:id', validate(idParam), async (req, res, next) => {
  try {
    const log = await prisma.foodLog.findUnique({ where: { id: req.params.id } });
    if (!log) return res.status(404).json({ error: 'Log not found' });
    if (log.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    await prisma.foodLog.delete({ where: { id: log.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/summary', validate(dateSchema), async (req, res, next) => {
  try {
    const { start, end } = dayBounds(req.query.date);
    const logs = await prisma.foodLog.findMany({
      where: { userId: req.user.id, loggedAt: { gte: start, lt: end } },
      include: { foodItem: true },
    });
    const totals = logs.reduce(
      (acc, l) => {
        const factor = l.grams / 100;
        acc.calories += l.foodItem.calories * factor;
        acc.protein += l.foodItem.protein * factor;
        acc.carbs += l.foodItem.carbs * factor;
        acc.fat += l.foodItem.fat * factor;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    res.json({
      date: start.toISOString().slice(0, 10),
      logCount: logs.length,
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein * 10) / 10,
      carbs: Math.round(totals.carbs * 10) / 10,
      fat: Math.round(totals.fat * 10) / 10,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;