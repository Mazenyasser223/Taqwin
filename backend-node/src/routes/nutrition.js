/**
 * Nutrition routes — WebTeb food library, search, food logging, daily summaries.
 */
const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const { prisma } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { searchWebteb, getWebtebCategories } = require('../lib/nutritionWebtebSearchCore');
const { toFoodDetailsFromWebteb } = require('../lib/webtebFoodDetails');
const { ensureFoodServingUnits, needsServingUnitEnrichment } = require('../lib/webtebServingUnits');
const { ensureFoodNameEn, needsNameEn } = require('../lib/webtebFoodNameEn');
const { getOrCreateUserSettings } = require('../lib/userSettings');
const { invalidateDashboardForUser } = require('../lib/dashboardCache');
const { resolveFoodDisplayName } = require('../lib/foodDisplayName');
const { analyzeMealImages, MAX_MEAL_CAPTURE_IMAGES } = require('../lib/mealVisionAnalyze');
const { lookupBarcodeProduct } = require('../lib/barcodeLookup');
const { resolveClosestWebtebFood } = require('../lib/aiToolResolvers');
const {
  attachSnapshotDisplay,
  per100FromFoodOrEntry,
  snapshotFieldsFromPer100,
  scaledMacrosFromLog,
} = require('../lib/foodLogSnapshot');
const { logger } = require('../lib/logger');

const MEAL_CAPTURE_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const MEAL_CAPTURE_MAX_BYTES = Number(process.env.MEAL_CAPTURE_MAX_UPLOAD_BYTES || 8 * 1024 * 1024);

const mealCaptureUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MEAL_CAPTURE_MAX_BYTES },
  fileFilter(_req, file, cb) {
    if (MEAL_CAPTURE_MIMES.has(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, JPEG, PNG, and WebP images are allowed'));
  },
});

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
    mealSlotId: z.string().min(1).max(64).optional(),
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
          macrosPer100: z
            .object({
              calories: z.number().min(0),
              protein: z.number().min(0),
              carbs: z.number().min(0),
              fat: z.number().min(0),
            })
            .optional(),
          kitchenFood: z.boolean().optional(),
        })
      )
      .min(1)
      .max(12),
  }),
});

const macroSnapshot = {
  calories: z.number().min(0).optional(),
  protein: z.number().min(0).optional(),
  carbs: z.number().min(0).optional(),
  fat: z.number().min(0).optional(),
};

const optionalFoodNutrients = {
  saturatedFat: z.number().min(0).max(1000).optional().nullable(),
  transFat: z.number().min(0).max(1000).optional().nullable(),
  cholesterol: z.number().min(0).max(100000).optional().nullable(),
  sodium: z.number().min(0).max(100000).optional().nullable(),
  potassium: z.number().min(0).max(100000).optional().nullable(),
  dietaryFiber: z.number().min(0).max(1000).optional().nullable(),
  sugars: z.number().min(0).max(1000).optional().nullable(),
  vitaminA: z.number().min(0).max(100000).optional().nullable(),
  vitaminC: z.number().min(0).max(100000).optional().nullable(),
  calcium: z.number().min(0).max(100000).optional().nullable(),
  iron: z.number().min(0).max(100000).optional().nullable(),
};

const kitchenFoodCreateSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(200),
    category: z.string().trim().min(1).max(80).default('user-kitchen'),
    calories: z.number().int().min(0).max(5000).optional(),
    protein: z.number().min(0).max(1000),
    carbs: z.number().min(0).max(1000),
    fat: z.number().min(0).max(1000),
    ...optionalFoodNutrients,
    imageUrl: z.string().url().optional().nullable(),
  }),
});

const kitchenFoodUpdateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      name: z.string().trim().min(1).max(200).optional(),
      category: z.string().trim().min(1).max(80).optional(),
      calories: z.number().int().min(0).max(5000).optional(),
      protein: z.number().min(0).max(1000).optional(),
      carbs: z.number().min(0).max(1000).optional(),
      fat: z.number().min(0).max(1000).optional(),
      ...optionalFoodNutrients,
      imageUrl: z.string().url().optional().nullable(),
    })
    .refine((body) => Object.keys(body).length > 0, { message: 'Provide at least one field' }),
});

const savedMealItemSchema = z
  .object({
    foodItemId: z.string().uuid().optional().nullable(),
    name: z.string().trim().min(1).max(200).optional(),
    grams: z.number().positive().max(5000),
    ...macroSnapshot,
  })
  .refine((item) => item.foodItemId || item.name, {
    message: 'Provide foodItemId or name',
  });

const savedMealCreateSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).optional().nullable(),
    defaultSlotId: z.string().min(1).max(64).optional().nullable(),
    items: z.array(savedMealItemSchema).min(1).max(50),
  }),
});

const savedMealUpdateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      name: z.string().trim().min(1).max(200).optional(),
      description: z.string().trim().max(1000).optional().nullable(),
      defaultSlotId: z.string().min(1).max(64).optional().nullable(),
      items: z.array(savedMealItemSchema).min(1).max(50).optional(),
    })
    .refine((body) => Object.keys(body).length > 0, { message: 'Provide at least one field' }),
});

const savedMealLogSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    date: dateOnly.optional(),
    slotId: z.string().min(1).max(64).optional(),
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
  if (item.macrosPer100) {
    return {
      calories: item.macrosPer100.calories,
      protein: item.macrosPer100.protein,
      carbs: item.macrosPer100.carbs,
      fat: item.macrosPer100.fat,
    };
  }
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

async function foodItemForPlanEntry(item, userId) {
  let entry = item;
  const hasClientMacros =
    item.macrosPer100 ||
    (item.calories != null &&
      item.grams > 0 &&
      (item.protein != null || item.carbs != null || item.fat != null));

  if (entry.kitchenFood) {
    const macros = per100MacrosForPlanItem(entry);
    const existing = await prisma.foodItem.findFirst({
      where: {
        userId,
        name: entry.name,
        category: 'user-kitchen',
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
      },
    });
    if (existing) return existing;

    return prisma.foodItem.create({
      data: {
        userId,
        name: entry.name,
        category: 'user-kitchen',
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        isPublic: false,
      },
    });
  }

  if (!entry.webtebId && entry.name && !hasClientMacros) {
    const resolved = await resolveClosestWebtebFood(entry.name);
    if (resolved?.webtebId) {
      const factor = entry.grams > 0 ? entry.grams / 100 : 1;
      entry = {
        ...entry,
        webtebId: resolved.webtebId,
        name: resolved.displayName || entry.name,
        calories:
          entry.calories != null ? entry.calories : Math.round(resolved.calories * factor),
        protein:
          entry.protein != null ? entry.protein : Math.round(resolved.protein * factor * 10) / 10,
        carbs: entry.carbs != null ? entry.carbs : Math.round(resolved.carbs * factor * 10) / 10,
        fat: entry.fat != null ? entry.fat : Math.round(resolved.fat * factor * 10) / 10,
      };
    }
  }

  if (entry.webtebId) {
    const existingWebteb = await prisma.foodItem.findUnique({ where: { webtebId: entry.webtebId } });
    if (existingWebteb) return existingWebteb;

    const webteb = await prisma.webtebFood.findUnique({
      where: { webtebId: entry.webtebId },
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

  const macros = per100MacrosForPlanItem(entry);
  const existing = await prisma.foodItem.findFirst({
    where: { name: entry.name, category: 'meal-plan', userId },
  });
  if (
    existing &&
    existing.calories === macros.calories &&
    existing.protein === macros.protein &&
    existing.carbs === macros.carbs &&
    existing.fat === macros.fat
  ) {
    return existing;
  }

  return prisma.foodItem.create({
    data: {
      userId,
      name: entry.name,
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

function accessibleFoodWhere(userId, extra = {}) {
  return {
    ...extra,
    OR: [{ isPublic: true }, { userId }],
  };
}

function userMealInclude() {
  return {
    items: {
      include: { foodItem: true },
      orderBy: { sortOrder: 'asc' },
    },
  };
}

function roundMacro(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function caloriesFromMacros(protein, carbs, fat) {
  return Math.round((Number(protein) || 0) * 4 + (Number(carbs) || 0) * 4 + (Number(fat) || 0) * 9);
}

function optionalFoodNutrientData(body) {
  const keys = [
    'saturatedFat',
    'transFat',
    'cholesterol',
    'sodium',
    'potassium',
    'dietaryFiber',
    'sugars',
    'vitaminA',
    'vitaminC',
    'calcium',
    'iron',
  ];
  return Object.fromEntries(keys.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
}

async function loadAccessibleFood(userId, foodItemId) {
  if (!foodItemId) return null;
  return prisma.foodItem.findFirst({
    where: accessibleFoodWhere(userId, { id: foodItemId }),
  });
}

async function savedMealItemData(userId, item, sortOrder) {
  const food = await loadAccessibleFood(userId, item.foodItemId);
  if (item.foodItemId && !food) {
    const err = new Error('Food item not found');
    err.status = 404;
    throw err;
  }
  return {
    foodItemId: food?.id,
    name: item.name || food?.name || 'Food',
    grams: item.grams,
    calories: item.calories ?? food?.calories,
    protein: item.protein ?? food?.protein,
    carbs: item.carbs ?? food?.carbs,
    fat: item.fat ?? food?.fat,
    sortOrder,
  };
}

function savedMealMacros(meal) {
  return meal.items.reduce(
    (acc, item) => {
      const food = item.foodItem;
      const calories = item.calories ?? food?.calories ?? 0;
      const protein = item.protein ?? food?.protein ?? 0;
      const carbs = item.carbs ?? food?.carbs ?? 0;
      const fat = item.fat ?? food?.fat ?? 0;
      const factor = item.grams / 100;
      acc.calories += calories * factor;
      acc.protein += protein * factor;
      acc.carbs += carbs * factor;
      acc.fat += fat * factor;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function withSavedMealTotals(meal) {
  const macros = savedMealMacros(meal);
  return {
    ...meal,
    totals: {
      calories: Math.round(macros.calories),
      protein: roundMacro(macros.protein),
      carbs: roundMacro(macros.carbs),
      fat: roundMacro(macros.fat),
    },
  };
}

async function foodForSavedMealLog(userId, item) {
  const food = await loadAccessibleFood(userId, item.foodItemId);
  if (food) return food;
  return prisma.foodItem.create({
    data: {
      userId,
      name: item.name,
      category: 'user-meal',
      calories: item.calories ?? 0,
      protein: item.protein ?? 0,
      carbs: item.carbs ?? 0,
      fat: item.fat ?? 0,
      isPublic: false,
    },
  });
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

router.get('/kitchen/foods', validate(searchSchema), async (req, res, next) => {
  try {
    const { search, category } = req.query;
    const where = { userId: req.user.id, isPublic: false };
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (category) where.category = category;
    let items = await prisma.foodItem.findMany({ where, orderBy: { name: 'asc' }, take: 500 });
    items = applyMacroFilters(items, req.query);
    res.json(items.slice(0, 200));
  } catch (err) {
    next(err);
  }
});

router.post('/kitchen/foods', validate(kitchenFoodCreateSchema), async (req, res, next) => {
  try {
    const item = await prisma.foodItem.create({
      data: {
        userId: req.user.id,
        name: req.body.name,
        category: req.body.category || 'user-kitchen',
        calories: req.body.calories ?? caloriesFromMacros(req.body.protein, req.body.carbs, req.body.fat),
        protein: req.body.protein,
        carbs: req.body.carbs,
        fat: req.body.fat,
        ...optionalFoodNutrientData(req.body),
        imageUrl: req.body.imageUrl || null,
        isPublic: false,
      },
    });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

router.patch('/kitchen/foods/:id', validate(kitchenFoodUpdateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.foodItem.findFirst({
      where: { id: req.params.id, userId: req.user.id, isPublic: false },
    });
    if (!existing) return res.status(404).json({ error: 'Kitchen food not found' });
    const item = await prisma.foodItem.update({
      where: { id: existing.id },
      data: {
        ...req.body,
        ...(req.body.protein != null && req.body.carbs != null && req.body.fat != null && req.body.calories == null
          ? { calories: caloriesFromMacros(req.body.protein, req.body.carbs, req.body.fat) }
          : {}),
      },
    });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

router.delete('/kitchen/foods/:id', validate(idParam), async (req, res, next) => {
  try {
    const existing = await prisma.foodItem.findFirst({
      where: { id: req.params.id, userId: req.user.id, isPublic: false },
    });
    if (!existing) return res.status(404).json({ error: 'Kitchen food not found' });
    await prisma.foodItem.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/kitchen/meals', async (req, res, next) => {
  try {
    const meals = await prisma.userMeal.findMany({
      where: { userId: req.user.id },
      include: userMealInclude(),
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    res.json(meals.map(withSavedMealTotals));
  } catch (err) {
    next(err);
  }
});

router.post('/kitchen/meals', validate(savedMealCreateSchema), async (req, res, next) => {
  try {
    const items = await Promise.all(
      req.body.items.map((item, index) => savedMealItemData(req.user.id, item, index))
    );
    const meal = await prisma.userMeal.create({
      data: {
        userId: req.user.id,
        name: req.body.name,
        description: req.body.description || null,
        defaultSlotId: req.body.defaultSlotId || null,
        items: { create: items },
      },
      include: userMealInclude(),
    });
    res.status(201).json(withSavedMealTotals(meal));
  } catch (err) {
    next(err);
  }
});

router.get('/kitchen/meals/:id', validate(idParam), async (req, res, next) => {
  try {
    const meal = await prisma.userMeal.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: userMealInclude(),
    });
    if (!meal) return res.status(404).json({ error: 'Saved meal not found' });
    res.json(withSavedMealTotals(meal));
  } catch (err) {
    next(err);
  }
});

router.patch('/kitchen/meals/:id', validate(savedMealUpdateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.userMeal.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Saved meal not found' });

    const data = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.description !== undefined) data.description = req.body.description || null;
    if (req.body.defaultSlotId !== undefined) data.defaultSlotId = req.body.defaultSlotId || null;

    const meal = await prisma.$transaction(async (tx) => {
      if (req.body.items) {
        const items = await Promise.all(
          req.body.items.map((item, index) => savedMealItemData(req.user.id, item, index))
        );
        await tx.userMealItem.deleteMany({ where: { mealId: existing.id } });
        data.items = { create: items };
      }
      return tx.userMeal.update({
        where: { id: existing.id },
        data,
        include: userMealInclude(),
      });
    });

    res.json(withSavedMealTotals(meal));
  } catch (err) {
    next(err);
  }
});

router.delete('/kitchen/meals/:id', validate(idParam), async (req, res, next) => {
  try {
    const existing = await prisma.userMeal.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Saved meal not found' });
    await prisma.userMeal.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/kitchen/meals/:id/log', validate(savedMealLogSchema), async (req, res, next) => {
  try {
    const meal = await prisma.userMeal.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: userMealInclude(),
    });
    if (!meal) return res.status(404).json({ error: 'Saved meal not found' });

    const loggedAt = loggedAtForDate(req.body.date);
    const slotId = req.body.slotId || meal.defaultSlotId || null;
    const logIds = [];
    for (const item of meal.items) {
      const food = await foodForSavedMealLog(req.user.id, item);
      const per100 = per100FromFoodOrEntry(food, {
        name: item.name,
        grams: item.grams,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
      });
      const log = await prisma.foodLog.create({
        data: {
          userId: req.user.id,
          foodItemId: food.id,
          grams: item.grams,
          mealSlotId: slotId,
          ...(loggedAt ? { loggedAt } : {}),
          ...snapshotFieldsFromPer100(item.name || food.name, per100),
        },
      });
      logIds.push(log.id);
    }

    const settings = await getOrCreateUserSettings(req.user.id);
    void invalidateDashboardForUser(req.user.id, settings?.timezone || 'UTC').catch(() => null);
    res.status(201).json({ mealId: meal.id, slotId, logIds });
  } catch (err) {
    next(err);
  }
});

router.get('/foods', validate(searchSchema), async (req, res, next) => {
  try {
    const { search, category } = req.query;
    const where = accessibleFoodWhere(req.user.id);
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
    const item = await prisma.foodItem.findFirst({
      where: accessibleFoodWhere(req.user.id, { id: req.params.id }),
    });
    if (!item) return res.status(404).json({ error: 'Food item not found' });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

const resolveFoodWebtebSchema = z.object({
  body: z.object({
    foodItemId: z.string().uuid(),
  }),
});

router.post('/food-items/resolve-webteb', validate(resolveFoodWebtebSchema), async (req, res, next) => {
  try {
    const food = await prisma.foodItem.findFirst({
      where: accessibleFoodWhere(req.user.id, { id: req.body.foodItemId }),
    });
    if (!food) return res.status(404).json({ error: 'Food item not found' });

    if (food.webtebId) {
      const webteb = await prisma.webtebFood.findUnique({ where: { webtebId: food.webtebId } });
      return res.json({
        webtebId: food.webtebId,
        displayName: webteb?.nameEn || webteb?.nameAr || food.name,
        nameAr: webteb?.nameAr ?? food.name,
        nameEn: webteb?.nameEn ?? null,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
      });
    }

    const resolved = await resolveClosestWebtebFood(food.name);
    if (!resolved?.webtebId) {
      if (food.userId) {
        return res.json({
          webtebId: null,
          displayName: food.name,
          nameAr: food.name,
          nameEn: null,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
          source: 'kitchen',
        });
      }
      return res.status(404).json({ error: 'Food not found in the nutrition library' });
    }

    if (food.userId) {
      return res.json({
        webtebId: resolved.webtebId,
        displayName: resolved.displayName,
        nameAr: resolved.nameAr,
        nameEn: resolved.nameEn,
        calories: resolved.calories,
        protein: resolved.protein,
        carbs: resolved.carbs,
        fat: resolved.fat,
      });
    }

    const updated = await prisma.foodItem.update({
      where: { id: food.id },
      data: {
        webtebId: resolved.webtebId,
        name: resolved.displayName || food.name,
        category: 'webteb',
        calories: resolved.calories,
        protein: resolved.protein,
        carbs: resolved.carbs,
        fat: resolved.fat,
        isPublic: true,
      },
    });

    res.json({
      webtebId: resolved.webtebId,
      displayName: resolved.displayName,
      nameAr: resolved.nameAr,
      nameEn: resolved.nameEn,
      calories: updated.calories,
      protein: updated.protein,
      carbs: updated.carbs,
      fat: updated.fat,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logs', validate(logCreateSchema), async (req, res, next) => {
  try {
    const food = await prisma.foodItem.findFirst({
      where: accessibleFoodWhere(req.user.id, { id: req.body.foodItemId }),
    });
    if (!food) return res.status(404).json({ error: 'Food item not found' });
    const per100 = per100FromFoodOrEntry(food);
    const log = await prisma.foodLog.create({
      data: {
        userId: req.user.id,
        foodItemId: req.body.foodItemId,
        grams: req.body.grams,
        mealSlotId: req.body.mealSlotId,
        loggedAt: req.body.loggedAt ? new Date(req.body.loggedAt) : undefined,
        ...snapshotFieldsFromPer100(food.displayName || food.name, per100),
      },
      include: { foodItem: true },
    });
    const settings = await getOrCreateUserSettings(req.user.id);
    void invalidateDashboardForUser(req.user.id, settings?.timezone || 'UTC').catch(() => null);
    res.status(201).json({
      ...log,
      foodItem: attachSnapshotDisplay(log.foodItem, log),
    });
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
          foodItem: food ? attachSnapshotDisplay({ ...food, displayName }, log) : food,
        };
      }),
    );
    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

router.get('/logs/:id', validate(idParam), async (req, res, next) => {
  try {
    const locale = (await getOrCreateUserSettings(req.user.id))?.language === 'en' ? 'en' : 'ar';
    const log = await prisma.foodLog.findUnique({
      where: { id: req.params.id },
      include: { foodItem: true },
    });
    if (!log) return res.status(404).json({ error: 'Log not found' });
    if (log.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const food = log.foodItem;
    const displayName = food ? await resolveFoodDisplayName(food, locale, prisma) : null;
    res.json({
      ...log,
      foodItem: food ? attachSnapshotDisplay({ ...food, displayName }, log) : food,
    });
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
    const locale = (await getOrCreateUserSettings(req.user.id))?.language === 'en' ? 'en' : 'ar';
    const food = updated.foodItem;
    const displayName = food ? await resolveFoodDisplayName(food, locale, prisma) : null;
    res.json({
      ...updated,
      foodItem: food ? attachSnapshotDisplay({ ...food, displayName }, updated) : food,
    });
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
        const scaled = scaledMacrosFromLog(l);
        acc.calories += scaled.calories;
        acc.protein += scaled.protein;
        acc.carbs += scaled.carbs;
        acc.fat += scaled.fat;
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

router.get('/barcode/:code', async (req, res, next) => {
  try {
    const result = await lookupBarcodeProduct(req.params.code);
    if (!result.found) {
      const status = result.error === 'INVALID_BARCODE' ? 400 : 404;
      return res.status(status).json({
        error: result.error || 'BARCODE_NOT_FOUND',
        message:
          result.error === 'INVALID_BARCODE'
            ? 'Invalid barcode format'
            : 'Product not found for this barcode',
      });
    }
    res.json({ product: result });
  } catch (err) {
    logger.error({ err, code: req.params.code }, 'Barcode lookup failed');
    next(err);
  }
});

router.post('/meal-capture/analyze', (req, res, next) => {
  mealCaptureUpload.array('images', MAX_MEAL_CAPTURE_IMAGES)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    next();
  });
}, async (req, res, next) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ error: 'Upload at least one meal photo' });
    }
    const referenceInfo = String(req.body?.referenceInfo || 'None (AI Guess)').trim() || 'None (AI Guess)';

    const result = await analyzeMealImages(files, referenceInfo);
    if (result?.error) {
      const status =
        result.error === 'API_KEY_INVALID'
          ? 503
          : result.error === 'QUOTA_EXCEEDED'
            ? 429
            : result.error === 'SAME_MEAL_MISMATCH'
              ? 400
              : 502;
      return res.status(status).json({
        error: result.error,
        message: result.message || result.error,
        ...(result.same_meal_validation ? { same_meal_validation: result.same_meal_validation } : {}),
      });
    }

    res.json(result);
  } catch (err) {
    logger.error({ err, userId: req.user?.id }, 'Meal capture analyze failed');
    next(err);
  }
});

router.post('/plan-meals/log', validate(planMealLogSchema), async (req, res, next) => {
  try {
    const loggedAt = loggedAtForDate(req.body.date);
    const logIds = [];
    for (const item of req.body.items) {
      const food = await foodItemForPlanEntry(item, req.user.id);
      const per100 = per100FromFoodOrEntry(food, item);
      const log = await prisma.foodLog.create({
        data: {
          userId: req.user.id,
          foodItemId: food.id,
          grams: item.grams,
          mealSlotId: req.body.slotId,
          ...(loggedAt ? { loggedAt } : {}),
          ...snapshotFieldsFromPer100(item.name || food.name, per100),
        },
      });
      logIds.push(log.id);
    }
    const settings = await getOrCreateUserSettings(req.user.id);
    void invalidateDashboardForUser(req.user.id, settings?.timezone || 'UTC').catch(() => null);
    res.status(201).json({ slotId: req.body.slotId, logIds });
  } catch (err) {
    next(err);
  }
});

module.exports = router;