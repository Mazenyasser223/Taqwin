/**
 * Nutrition routes — WebTeb food library, search, food logging, daily summaries.
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { searchWebteb, getWebtebCategories } = require('../lib/nutritionWebtebSearchCore');
const { toFoodDetailsFromWebteb } = require('../lib/webtebFoodDetails');
const { ensureFoodServingUnits, needsServingUnitEnrichment } = require('../lib/webtebServingUnits');
const { ensureFoodNameEn, needsNameEn } = require('../lib/webtebFoodNameEn');
const { getOrCreateUserSettings } = require('../lib/userSettings');
const { resolveFoodDisplayName } = require('../lib/foodDisplayName');

function defaultGramServingUnits() {
  return [{ label: '100 غرام', weightText: '100 غرام', weightGrams: 100, weightId: null }];
}

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

const webtebSearchSchema = z.object({
  query: z
    .object({
      q: z.string().max(200).optional(),
      categoryId: z.string().max(64).optional(),
      page: z.coerce.number().int().min(1).optional(),
      pageSize: z.coerce.number().int().min(1).max(50).optional(),
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
      sort2: z
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

const webtebDetailsSchema = z.object({
  params: z.object({
    webtebId: z.coerce.number().int().positive(),
  }),
});

const webtebImportSchema = z.object({
  body: z.object({
    webtebId: z.number().int().positive(),
  }),
});

const webtebResolveSchema = z.object({
  body: z.object({
    webtebIds: z.array(z.coerce.number().int().positive()).max(120),
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

const logUpdateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    grams: z.number().positive().max(5000),
  }),
});

const planMealLogSchema = z.object({
  body: z.object({
    date: dateOnly.optional(),
    slotId: z.string().min(1).max(64),
    items: z
      .array(
        z.object({
          name: z.string().min(1).max(200),
          grams: z.number().positive().max(5000),
          role: z.enum(['protein', 'carb', 'fat', 'fruit', 'dairy', 'mixed']).optional(),
          webtebId: z.coerce.number().int().positive().optional(),
          calories: z.number().min(0).optional(),
          protein: z.number().min(0).optional(),
          carbs: z.number().min(0).optional(),
          fat: z.number().min(0).optional(),
        })
      )
      .min(1)
      .max(12),
  }),
});

const PLAN_ROLE_MACROS = {
  protein: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  carb: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  fat: { calories: 884, protein: 0, carbs: 0, fat: 100 },
  fruit: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  dairy: { calories: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  mixed: { calories: 150, protein: 8, carbs: 15, fat: 5 },
};

function per100MacrosForPlanItem(item) {
  if (item.calories != null && item.grams > 0) {
    const factor = 100 / item.grams;
    return {
      calories: Math.max(1, Math.round(item.calories * factor)),
      protein: Math.round((item.protein ?? 0) * factor * 10) / 10,
      carbs: Math.round((item.carbs ?? 0) * factor * 10) / 10,
      fat: Math.round((item.fat ?? 0) * factor * 10) / 10,
    };
  }
  return PLAN_ROLE_MACROS[item.role] || PLAN_ROLE_MACROS.mixed;
}

async function foodItemForPlanEntry(item) {
  if (item.webtebId) {
    const existingWebteb = await prisma.foodItem.findUnique({ where: { webtebId: item.webtebId } });
    if (existingWebteb) return existingWebteb;

    const webteb = await prisma.webtebFood.findUnique({
      where: { webtebId: item.webtebId },
      include: { category: true },
    });
    if (webteb) {
      return prisma.foodItem.create({
        data: {
          webtebId: webteb.webtebId,
          name: webteb.nameAr,
          category: webteb.category?.nameAr || webteb.categorySlug,
          calories: webteb.calories,
          protein: webteb.protein,
          carbs: webteb.carbs,
          fat: webteb.fat,
          isPublic: true,
        },
      });
    }
  }

  const macros = per100MacrosForPlanItem(item);
  const existing = await prisma.foodItem.findFirst({
    where: { name: item.name, category: 'meal-plan' },
  });
  if (existing) {
    if (
      existing.calories !== macros.calories ||
      existing.protein !== macros.protein ||
      existing.carbs !== macros.carbs ||
      existing.fat !== macros.fat
    ) {
      return prisma.foodItem.update({
        where: { id: existing.id },
        data: macros,
      });
    }
    return existing;
  }

  return prisma.foodItem.create({
    data: {
      name: item.name,
      category: 'meal-plan',
      calories: macros.calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      isPublic: false,
    },
  });
}

const idParam = z.object({ params: z.object({ id: z.string().uuid() }) });

function dayBounds(dateStr) {
  const start = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : new Date(new Date().setUTCHours(0, 0, 0, 0));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function loggedAtForDate(dateStr) {
  if (!dateStr) return undefined;
  return new Date(`${dateStr}T12:00:00.000Z`);
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

router.get('/webteb/categories', async (_req, res, next) => {
  try {
    const { categories, totalFoods } = await getWebtebCategories();
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ categories, totalFoods, source: 'webteb' });
  } catch (err) {
    next(err);
  }
});

router.get('/webteb/search', validate(webtebSearchSchema), async (req, res, next) => {
  try {
    const {
      q,
      categoryId,
      page = 1,
      pageSize = 25,
      sort,
      sort2,
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

    const filterQuery = {
      sort,
      sort2,
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

    const payload = await searchWebteb({
      q,
      categoryId,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 25,
      filterQuery,
    });

    if (payload.emptyDatabase) {
      return res.status(503).json({
        error: 'WebTeb food database is not imported yet. Run: npm run import:webteb',
        emptyDatabase: true,
      });
    }

    const cacheSec = Number(process.env.WEBTEB_CLIENT_CACHE_SEC) || 300;
    res.set('Cache-Control', `private, max-age=${cacheSec}`);
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.get('/webteb/:webtebId', validate(webtebDetailsSchema), async (req, res, next) => {
  try {
    const webtebId = Number(req.params.webtebId);
    if (!Number.isFinite(webtebId) || webtebId < 1) {
      return res.status(400).json({ error: 'Invalid webtebId' });
    }
    const food = await prisma.webtebFood.findUnique({
      where: { webtebId },
      include: { category: true },
    });
    if (!food) return res.status(404).json({ error: 'Food not found in WebTeb database' });

    if (needsNameEn(food)) {
      void ensureFoodNameEn(food, prisma);
    }

    let servingUnits = Array.isArray(food.servingUnits) ? food.servingUnits : [];
    if (servingUnits.length === 0) servingUnits = defaultGramServingUnits();

    if (needsServingUnitEnrichment(food.servingUnits) && food.url) {
      void ensureFoodServingUnits(food)
        .then((enriched) => {
          if (enriched?.length) {
            return prisma.webtebFood.update({
              where: { webtebId },
              data: { servingUnits: enriched },
            });
          }
        })
        .catch((enrichErr) => {
          console.warn('[webteb] serving unit enrich failed', webtebId, enrichErr.message);
        });
    }

    res.set('Cache-Control', 'private, max-age=600');
    res.json(toFoodDetailsFromWebteb({ ...food, servingUnits }, food.category?.nameAr));
  } catch (err) {
    next(err);
  }
});

router.post('/webteb/import', validate(webtebImportSchema), async (req, res, next) => {
  try {
    const { webtebId } = req.body;
    const existing = await prisma.foodItem.findUnique({ where: { webtebId } });
    if (existing) return res.json(existing);

    const food = await prisma.webtebFood.findUnique({
      where: { webtebId },
      include: { category: true },
    });
    if (!food) return res.status(404).json({ error: 'Food not found in WebTeb database' });

    const item = await prisma.foodItem.create({
      data: {
        webtebId: food.webtebId,
        name: food.nameAr,
        category: food.category?.nameAr || food.categorySlug,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        isPublic: true,
      },
    });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

/** Batch-resolve WebTeb food display names for dossier / catalog picks (by webtebId). */
router.post('/webteb/resolve-names', validate(webtebResolveSchema), async (req, res, next) => {
  try {
    const locale = (await getOrCreateUserSettings(req.user.id))?.language === 'en' ? 'en' : 'ar';
    const ids = [...new Set(req.body.webtebIds)].slice(0, 120);
    if (!ids.length) return res.json({ names: {} });

    const rows = await prisma.webtebFood.findMany({
      where: { webtebId: { in: ids } },
      select: { webtebId: true, nameAr: true, nameEn: true },
    });

    const names = {};
    await Promise.all(
      rows.map(async (row) => {
        const displayName = await resolveFoodDisplayName(
          { name: row.nameAr, webtebId: row.webtebId },
          locale,
          prisma,
        );
        names[String(row.webtebId)] = {
          nameAr: row.nameAr,
          nameEn: row.nameEn ?? null,
          displayName,
        };
      }),
    );

    res.json({ names, locale });
  } catch (err) {
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
    const locale = (await getOrCreateUserSettings(req.user.id))?.language === 'en' ? 'en' : 'ar';
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
    const nameCache = new Map();
    const enriched = await Promise.all(
      logs.map(async (log) => {
        const food = log.foodItem;
        const key = food?.id || food?.name || log.id;
        let displayName = nameCache.get(key);
        if (!displayName) {
          displayName = await resolveFoodDisplayName(food, locale, prisma);
          nameCache.set(key, displayName);
        }
        return {
          ...log,
          foodItem: food ? { ...food, displayName } : food,
        };
      }),
    );
    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

router.patch('/logs/:id', validate(logUpdateSchema), async (req, res, next) => {
  try {
    const log = await prisma.foodLog.findUnique({
      where: { id: req.params.id },
      include: { foodItem: true },
    });
    if (!log) return res.status(404).json({ error: 'Log not found' });
    if (log.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const updated = await prisma.foodLog.update({
      where: { id: log.id },
      data: { grams: req.body.grams },
      include: { foodItem: true },
    });
    res.json(updated);
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

router.post('/plan-meals/log', validate(planMealLogSchema), async (req, res, next) => {
  try {
    const loggedAt = loggedAtForDate(req.body.date);
    const logIds = [];
    for (const item of req.body.items) {
      const food = await foodItemForPlanEntry(item);
      const log = await prisma.foodLog.create({
        data: {
          userId: req.user.id,
          foodItemId: food.id,
          grams: item.grams,
          ...(loggedAt ? { loggedAt } : {}),
        },
      });
      logIds.push(log.id);
    }
    res.status(201).json({ slotId: req.body.slotId, logIds });
  } catch (err) {
    next(err);
  }
});

module.exports = router;