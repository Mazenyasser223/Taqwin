/**
 * Exercise catalog — MuscleWiki data in Postgres.
 *
 * Public read: list, categories, muscle-counts, difficulties, :id
 * Auth required: favorites, logs, plan/log
 */
const express = require('express');
const { randomUUID } = require('crypto');
const { z } = require('zod');
const { Prisma } = require('../../generated/prisma');
const { prisma } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { muscleLabelsForZone, normalizeExercise } = require('../lib/exerciseMuscleMap');
const { EXERCISE_MUSCLE_BROWSE_ZONES } = require('../lib/exerciseMuscleBrowse');
const {
  categoriesForGroup,
  allGroupedCategories,
  isOtherGroup,
} = require('../lib/exerciseCategoryGroups');
const { ensureExercisesNameAr, ensureExerciseNameAr } = require('../lib/exerciseNameAr');
const { parseExerciseLogNotes, encodeExerciseLogNotes } = require('../lib/exerciseLogNotes');
const { searchExercises, MIN_QUERY_LEN } = require('../lib/exerciseSearchCore');
const {
  parseGoalsParam,
  goalsPrismaFilter,
} = require('../lib/exerciseFitnessGoals');
const savedExerciseStore = require('../lib/savedExerciseStore');
const exerciseBrowseMetadata = require('../lib/exerciseBrowseMetadata');
const { browseCacheMaxAgeSec } = require('../lib/exerciseBrowseCache');

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

function serializeExerciseLog(log, exercise, locale) {
  const parsed = parseExerciseLogNotes(log.notes);
  return {
    ...log,
    sets: parsed.sets,
    reps: parsed.reps,
    setDetails: parsed.setDetails,
    userNotes: parsed.userNotes,
    durationSec: parsed.durationSec,
    exercise: exercise ? normalizeExercise(exercise, locale) : null,
  };
}

function parseLocale(query) {
  return query?.locale === 'en' ? 'en' : 'ar';
}

const router = express.Router();

const listSchema = z.object({
  category: z.string().optional(),
  categories: z.string().optional(),
  categoryGroup: z.string().optional(),
  muscle: z.string().optional(),
  set: z.enum(['browse', 'wiki']).optional(),
  difficulty: z.string().optional(),
  goals: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(['name', 'random']).optional(),
  seed: z.string().max(64).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(60).optional(),
});

function parseCategoriesParam(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];
}

function parseListQuery(query) {
  const parsed = listSchema.safeParse(query ?? {});
  if (!parsed.success) {
    const err = new Error('Validation failed');
    err.status = 400;
    err.details = parsed.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    throw err;
  }
  const page = parsed.data.page ?? 1;
  const pageSize = parsed.data.pageSize ?? 24;
  return {
    category: parsed.data.category,
    categories: parseCategoriesParam(parsed.data.categories),
    categoryGroup: parsed.data.categoryGroup,
    muscle: parsed.data.muscle,
    set: parsed.data.set === 'wiki' ? 'wiki' : 'browse',
    difficulty: parsed.data.difficulty?.trim() || null,
    goals: parseGoalsParam(parsed.data.goals),
    search: parsed.data.search?.trim() || null,
    sort: parsed.data.sort === 'random' ? 'random' : 'name',
    seed: parsed.data.seed?.trim() || 'taqwin',
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

function categoryGroupWhere(groupId) {
  if (!groupId) return null;
  if (isOtherGroup(groupId)) {
    const known = allGroupedCategories();
    return known.length ? { category: { notIn: known } } : null;
  }
  const cats = categoriesForGroup(groupId);
  if (!cats?.length) return null;
  return { category: { in: cats } };
}

function buildSearchFilters({
  browseMuscle,
  effectiveCategory,
  categoriesIn,
  groupWhere,
  wikiLabels,
  difficulty,
  goals,
}) {
  const filters = {};
  if (browseMuscle) filters.browseMuscleZone = browseMuscle;
  if (effectiveCategory) filters.category = effectiveCategory;
  else if (categoriesIn?.length) filters.categoriesIn = categoriesIn;
  else if (groupWhere?.category?.in) filters.categoriesIn = groupWhere.category.in;
  else if (groupWhere?.category?.notIn) filters.categoriesNotIn = groupWhere.category.notIn;
  if (wikiLabels?.length) filters.wikiLabels = wikiLabels;
  if (difficulty) filters.difficulty = difficulty;
  if (goals?.length) filters.goals = goals;
  return filters;
}

function resolveCategoryScope({ category, categories, categoryGroup }) {
  if (category) {
    return { effectiveCategory: category, categoriesIn: null, groupWhere: null };
  }
  if (categories?.length === 1) {
    return { effectiveCategory: categories[0], categoriesIn: null, groupWhere: null };
  }
  if (categories?.length > 1) {
    return { effectiveCategory: null, categoriesIn: categories, groupWhere: null };
  }
  return {
    effectiveCategory: null,
    categoriesIn: null,
    groupWhere: categoryGroupWhere(categoryGroup),
  };
}

function categoryPrismaWhere(scope) {
  const { effectiveCategory, categoriesIn, groupWhere } = scope;
  if (effectiveCategory) return { category: effectiveCategory };
  if (categoriesIn?.length) return { category: { in: categoriesIn } };
  return groupWhere ?? {};
}

function categorySqlFromScope(scope) {
  const { effectiveCategory, categoriesIn, groupWhere } = scope;
  if (effectiveCategory) return Prisma.sql`AND category = ${effectiveCategory}`;
  if (categoriesIn?.length) {
    return Prisma.sql`AND category IN (${Prisma.join(categoriesIn.map((c) => Prisma.sql`${c}`))})`;
  }
  if (groupWhere?.category?.in) {
    return Prisma.sql`AND category IN (${Prisma.join(groupWhere.category.in.map((c) => Prisma.sql`${c}`))})`;
  }
  if (groupWhere?.category?.notIn) {
    return Prisma.sql`AND category NOT IN (${Prisma.join(groupWhere.category.notIn.map((c) => Prisma.sql`${c}`))})`;
  }
  return Prisma.empty;
}

function difficultyClause(difficulty) {
  return difficulty ? { difficulty } : {};
}

async function respondExerciseList(res, { rows, total, page, pageSize, offset, locale }) {
  const withAr =
    locale === 'ar'
      ? await ensureExercisesNameAr(rows, prisma, { max: pageSize, liveTranslate: false })
      : rows;
  return res.json({
    items: withAr.map((row) => normalizeExercise(row, locale)),
    page,
    pageSize,
    total,
    hasMore: offset + rows.length < total,
  });
}

function browseFilterSql(prismaWhere) {
  const parts = [Prisma.sql`is_public = true`];
  if (prismaWhere.browseMuscleZone) {
    parts.push(Prisma.sql`browse_muscle_zone = ${prismaWhere.browseMuscleZone}`);
  }
  if (prismaWhere.difficulty) {
    parts.push(Prisma.sql`difficulty = ${prismaWhere.difficulty}`);
  }
  if (prismaWhere.category) {
    if (typeof prismaWhere.category === 'string') {
      parts.push(Prisma.sql`category = ${prismaWhere.category}`);
    } else if (prismaWhere.category.in?.length) {
      parts.push(
        Prisma.sql`category IN (${Prisma.join(prismaWhere.category.in.map((c) => Prisma.sql`${c}`))})`
      );
    } else if (prismaWhere.category.notIn?.length) {
      parts.push(
        Prisma.sql`category NOT IN (${Prisma.join(prismaWhere.category.notIn.map((c) => Prisma.sql`${c}`))})`
      );
    }
  }
  if (prismaWhere.fitnessGoals?.hasSome?.length) {
    parts.push(
      Prisma.sql`fitness_goals && ARRAY[${Prisma.join(
        prismaWhere.fitnessGoals.hasSome.map((g) => Prisma.sql`${g}`)
      )}]::text[]`
    );
  }
  return Prisma.join(parts, ' AND ');
}

async function listExercisesRandomOrder({ prismaWhere, pageSize, offset, seed }) {
  const seedVal = String(seed || 'taqwin').slice(0, 64);
  const whereSql = browseFilterSql(prismaWhere);

  const idRows = await prisma.$queryRaw`
    SELECT id FROM exercises
    WHERE ${whereSql}
    ORDER BY md5(id::text || ${seedVal})
    LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}
  `;
  const countRows = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count FROM exercises WHERE ${whereSql}
  `;
  const ids = idRows.map((r) => r.id);
  const total = Number(countRows[0]?.count ?? 0);
  if (!ids.length) return { rows: [], total };

  const rows = await prisma.exercise.findMany({ where: { id: { in: ids } } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
  return { rows: ordered, total };
}

async function listExercisesWithOptionalSearch({
  searchTerm,
  locale,
  filters,
  prismaWhere,
  page: _page,
  pageSize,
  offset,
  sort = 'name',
  seed = 'taqwin',
  orderBy = { name: 'asc' },
}) {
  if (searchTerm && searchTerm.length >= MIN_QUERY_LEN) {
    const searched = await searchExercises(prisma, {
      query: searchTerm,
      locale,
      filters,
      pageSize,
      offset,
    });
    if (searched) return searched;
  }

  if (sort === 'random') {
    return listExercisesRandomOrder({ prismaWhere, pageSize, offset, seed });
  }

  const [rows, total] = await Promise.all([
    prisma.exercise.findMany({
      where: prismaWhere,
      orderBy,
      skip: Number(offset),
      take: Number(pageSize),
    }),
    prisma.exercise.count({ where: prismaWhere }),
  ]);
  return { rows, total };
}

const idParam = z.object({ params: z.object({ id: z.string().min(1) }) });

const logSchema = z.object({
  body: z.object({
    exerciseId: z.string().min(1),
    notes: z.string().max(1000).optional(),
    sets: z.number().int().positive().max(50).optional(),
    reps: z.number().int().positive().max(500).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
});

const setDetailSchema = z.object({
  kg: z.number().nullable().optional(),
  reps: z.number().int().nullable().optional(),
  completed: z.boolean().optional(),
});

const logUpdateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    sets: z.number().int().positive().max(50),
    reps: z.number().int().positive().max(500),
    setDetails: z.array(setDetailSchema).max(50).optional(),
    userNotes: z.string().max(1000).optional(),
    durationSec: z.number().int().min(0).max(86400).optional(),
  }),
});

const planExerciseLogSchema = z.object({
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    items: z
      .array(
        z.object({
          exerciseId: z.string().uuid().optional(),
          name: z.string().min(1).max(200),
          sets: z.number().int().positive().max(50),
          reps: z.number().int().positive().max(500),
          setDetails: z.array(setDetailSchema).max(50).optional(),
          userNotes: z.string().max(1000).optional(),
          durationSec: z.number().int().min(0).max(86400).optional(),
        })
      )
      .min(1)
      .max(30),
  }),
});

const dateSchema = z.object({
  query: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    locale: z.enum(['en', 'ar']).optional(),
  }),
});

async function exerciseForPlanEntry(item) {
  if (item.exerciseId) {
    const existing = await prisma.exercise.findFirst({
      where: { id: item.exerciseId, isPublic: true },
    });
    if (existing) return existing;
  }
  const byName = await prisma.exercise.findFirst({
    where: { name: { equals: item.name, mode: 'insensitive' }, isPublic: true },
  });
  if (byName) return byName;
  throw new Error(`Exercise not found: ${item.name}`);
}

function muscleOverlapSql(labels) {
  return Prisma.sql`primary_muscles ?| ARRAY[${Prisma.join(labels.map((l) => Prisma.sql`${l}`))}]::text[]`;
}

function sendBrowseMetadata(res, payload) {
  res.set('Cache-Control', `public, max-age=${browseCacheMaxAgeSec()}, stale-while-revalidate=60`);
  return res.json(payload);
}

router.get('/categories', async (_req, res, next) => {
  try {
    return sendBrowseMetadata(res, await exerciseBrowseMetadata.getCategories());
  } catch (err) {
    next(err);
  }
});

router.get('/category-groups', async (_req, res, next) => {
  try {
    return sendBrowseMetadata(res, await exerciseBrowseMetadata.getCategoryGroups());
  } catch (err) {
    next(err);
  }
});

router.get('/goal-counts', async (_req, res, next) => {
  try {
    return sendBrowseMetadata(res, await exerciseBrowseMetadata.getGoalCounts());
  } catch (err) {
    next(err);
  }
});

router.get('/difficulties', async (_req, res, next) => {
  try {
    return sendBrowseMetadata(res, await exerciseBrowseMetadata.getDifficulties());
  } catch (err) {
    next(err);
  }
});

router.get('/muscle-counts', async (req, res, next) => {
  try {
    const set = req.query.set === 'wiki' ? 'wiki' : 'browse';
    return sendBrowseMetadata(res, await exerciseBrowseMetadata.getMuscleCounts(set));
  } catch (err) {
    next(err);
  }
});

router.get('/logs/me', authMiddleware, validate(dateSchema), async (req, res, next) => {
  try {
    const locale = parseLocale(req.query);
    const where = { userId: req.user.id };
    if (req.query.date) {
      const { start, end } = dayBounds(req.query.date);
      where.loggedAt = { gte: start, lt: end };
    }
    const logs = await prisma.exerciseLog.findMany({
      where,
      include: { exercise: true },
      orderBy: { loggedAt: 'desc' },
      take: 100,
    });
    const enriched =
      locale === 'ar'
        ? await ensureExercisesNameAr(
            logs.map((l) => l.exercise).filter(Boolean),
            prisma,
            { max: 100 },
          )
        : [];
    const byId = new Map(enriched.map((e) => [e.id, e]));
    res.json(
      logs.map((log) =>
        serializeExerciseLog(
          log,
          log.exercise ? byId.get(log.exercise.id) ?? log.exercise : null,
          locale
        )
      )
    );
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    let q;
    try {
      q = parseListQuery(req.query);
    } catch (err) {
      if (err.status === 400) {
        return res.status(400).json({ error: err.message, details: err.details });
      }
      throw err;
    }

    const { category, categories, categoryGroup, muscle, difficulty, goals, set, search: searchTerm, sort, seed, page, pageSize, offset } = q;
    const locale = parseLocale(req.query);
    const wikiLabels = set === 'wiki' && muscle ? muscleLabelsForZone(muscle) : null;
    const browseMuscle =
      set === 'browse' && muscle && EXERCISE_MUSCLE_BROWSE_ZONES.includes(muscle) ? muscle : null;
    const categoryScope = resolveCategoryScope({ category, categories, categoryGroup });
    const { effectiveCategory, categoriesIn, groupWhere } = categoryScope;
    const goalsFilter = goalsPrismaFilter(goals);

  if (browseMuscle) {
      const prismaWhere = {
        isPublic: true,
        browseMuscleZone: browseMuscle,
        ...difficultyClause(difficulty),
        ...categoryPrismaWhere(categoryScope),
        ...(goalsFilter ?? {}),
      };
      const filters = buildSearchFilters({
        browseMuscle,
        effectiveCategory,
        categoriesIn,
        groupWhere,
        difficulty,
        goals,
      });
      const { rows, total } = await listExercisesWithOptionalSearch({
        searchTerm,
        locale,
        filters,
        prismaWhere,
        page,
        pageSize,
        offset,
        sort,
        seed,
      });
      return respondExerciseList(res, { rows, total, page, pageSize, offset, locale });
    }

  if (wikiLabels) {
      const filters = buildSearchFilters({
        effectiveCategory,
        categoriesIn,
        groupWhere,
        wikiLabels,
        difficulty,
        goals,
      });
      if (searchTerm && searchTerm.length >= MIN_QUERY_LEN) {
        const searched = await searchExercises(prisma, {
          query: searchTerm,
          locale,
          filters,
          pageSize,
          offset,
        });
        if (searched) {
          return respondExerciseList(res, {
            rows: searched.rows,
            total: searched.total,
            page,
            pageSize,
            offset,
            locale,
          });
        }
      }

      const searchSql = searchTerm
        ? locale === 'ar'
          ? Prisma.sql`AND (name ILIKE ${`%${searchTerm}%`} OR name_ar ILIKE ${`%${searchTerm}%`})`
          : Prisma.sql`AND name ILIKE ${`%${searchTerm}%`}`
        : Prisma.empty;

      const categorySql = categorySqlFromScope(categoryScope);

      const difficultySql = difficulty
        ? Prisma.sql`AND difficulty = ${difficulty}`
        : Prisma.empty;

      const rows = await prisma.$queryRaw`
        SELECT *
        FROM exercises
        WHERE is_public = true
        ${categorySql}
        AND ${muscleOverlapSql(wikiLabels)}
        ${difficultySql}
        ${searchSql}
      ORDER BY name ASC
        LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}
      `;

      const countRows = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS count
        FROM exercises
        WHERE is_public = true
        ${categorySql}
        AND ${muscleOverlapSql(wikiLabels)}
        ${difficultySql}
        ${searchSql}
      `;

      const total = Number(countRows[0]?.count ?? 0);
      return respondExerciseList(res, { rows, total, page, pageSize, offset, locale });
    }

    const prismaWhere = {
      isPublic: true,
      ...difficultyClause(difficulty),
      ...categoryPrismaWhere(categoryScope),
      ...(goalsFilter ?? {}),
    };
    const filters = buildSearchFilters({
      effectiveCategory,
      categoriesIn,
      groupWhere,
      difficulty,
      goals,
    });
    const { rows, total } = await listExercisesWithOptionalSearch({
      searchTerm,
      locale,
      filters,
      prismaWhere,
      page,
      pageSize,
      offset,
      sort,
      seed,
    });
    return respondExerciseList(res, { rows, total, page, pageSize, offset, locale });
  } catch (err) {
    next(err);
  }
});

router.get('/favorites/list', authMiddleware, async (req, res, next) => {
  try {
    let q;
    try {
      q = parseListQuery(req.query);
    } catch (err) {
      if (err.status === 400) {
        return res.status(400).json({ error: err.message, details: err.details });
      }
      throw err;
    }

    const locale = parseLocale(req.query);
    const {
      category,
      categories,
      muscle,
      difficulty,
      goals,
      search: searchTerm,
      page,
      pageSize,
      offset,
    } = q;

    const browseMuscle =
      muscle && EXERCISE_MUSCLE_BROWSE_ZONES.includes(muscle) ? muscle : null;
    const categoryScope = resolveCategoryScope({ category, categories, categoryGroup: null });

    const searchFilters = buildSearchFilters({
      browseMuscle,
      effectiveCategory: categoryScope.effectiveCategory,
      categoriesIn: categoryScope.categoriesIn,
      groupWhere: categoryScope.groupWhere,
      difficulty,
      goals,
    });

    const { rows, total } = await savedExerciseStore.listSavedExercises(req.user.id, {
      searchFilters,
      searchTerm,
      offset,
      pageSize,
    });
    return respondExerciseList(res, { rows, total, page, pageSize, offset, locale });
  } catch (err) {
    next(err);
  }
});

router.get('/favorites/me', authMiddleware, async (req, res, next) => {
  try {
    const exerciseIds = await savedExerciseStore.getFavoriteExerciseIds(req.user.id);
    res.json({ exerciseIds });
  } catch (err) {
    next(err);
  }
});

router.post('/favorites/:id', authMiddleware, validate(idParam), async (req, res, next) => {
  try {
    const exercise = await prisma.exercise.findFirst({
      where: { id: req.params.id, isPublic: true },
      select: { id: true },
    });
    if (!exercise) return res.status(404).json({ error: 'Exercise not found' });

    await savedExerciseStore.saveFavorite(req.user.id, exercise.id);
    res.status(201).json({ saved: true, exerciseId: exercise.id });
  } catch (err) {
    next(err);
  }
});

router.delete('/favorites/:id', authMiddleware, validate(idParam), async (req, res, next) => {
  try {
    await savedExerciseStore.removeFavorite(req.user.id, req.params.id);
    res.json({ saved: false, exerciseId: req.params.id });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', validate(idParam), async (req, res, next) => {
  try {
    const locale = parseLocale(req.query);
    const exercise = await prisma.exercise.findFirst({
      where: { id: req.params.id, isPublic: true },
    });
    if (!exercise) return res.status(404).json({ error: 'Exercise not found' });
    const enriched = locale === 'ar' ? await ensureExerciseNameAr(exercise, prisma) : exercise;
    res.json(normalizeExercise(enriched, locale));
  } catch (err) {
    next(err);
  }
});

router.post('/logs', authMiddleware, validate(logSchema), async (req, res, next) => {
  try {
    const locale = parseLocale(req.query);
    const exercise = await prisma.exercise.findFirst({
      where: { id: req.body.exerciseId, isPublic: true },
    });
    if (!exercise) return res.status(404).json({ error: 'Exercise not found' });

    const notes =
      req.body.sets != null && req.body.reps != null
        ? encodeExerciseLogNotes({ sets: req.body.sets, reps: req.body.reps })
        : req.body.notes;

    const loggedAt = loggedAtForDate(req.body.date);
    const log = await prisma.exerciseLog.create({
      data: {
        id: randomUUID(),
        userId: req.user.id,
        exerciseId: req.body.exerciseId,
        notes,
        ...(loggedAt ? { loggedAt } : {}),
      },
      include: { exercise: true },
    });
    const normalized =
      locale === 'ar' ? await ensureExerciseNameAr(log.exercise, prisma) : log.exercise;
    res.status(201).json(serializeExerciseLog(log, normalized, locale));
  } catch (err) {
    next(err);
  }
});

router.patch('/logs/:id', authMiddleware, validate(logUpdateSchema), async (req, res, next) => {
  try {
    const locale = parseLocale(req.query);
    const log = await prisma.exerciseLog.findUnique({
      where: { id: req.params.id },
      include: { exercise: true },
    });
    if (!log) return res.status(404).json({ error: 'Log not found' });
    if (log.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const updated = await prisma.exerciseLog.update({
      where: { id: log.id },
      data: {
        notes: encodeExerciseLogNotes({
          sets: req.body.sets,
          reps: req.body.reps,
          setDetails: req.body.setDetails,
          userNotes: req.body.userNotes,
          durationSec: req.body.durationSec,
        }),
      },
      include: { exercise: true },
    });
    const normalized =
      locale === 'ar' ? await ensureExerciseNameAr(updated.exercise, prisma) : updated.exercise;
    res.json(serializeExerciseLog(updated, normalized, locale));
  } catch (err) {
    next(err);
  }
});

router.delete('/logs/:id', authMiddleware, validate(idParam), async (req, res, next) => {
  try {
    const log = await prisma.exerciseLog.findUnique({ where: { id: req.params.id } });
    if (!log) return res.status(404).json({ error: 'Log not found' });
    if (log.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    await prisma.exerciseLog.delete({ where: { id: log.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/plan/log', authMiddleware, validate(planExerciseLogSchema), async (req, res, next) => {
  try {
    const loggedAt = loggedAtForDate(req.body.date);
    const logIds = [];
    for (const item of req.body.items) {
      const exercise = await exerciseForPlanEntry(item);
      const log = await prisma.exerciseLog.create({
        data: {
          id: randomUUID(),
          userId: req.user.id,
          exerciseId: exercise.id,
          notes: encodeExerciseLogNotes({
            sets: item.sets,
            reps: item.reps,
            setDetails: item.setDetails,
            userNotes: item.userNotes,
            durationSec: item.durationSec,
          }),
          ...(loggedAt ? { loggedAt } : {}),
        },
        include: { exercise: true },
      });
      logIds.push(log.id);
    }
    res.status(201).json({ logIds });
  } catch (err) {
    if (err.message?.startsWith('Exercise not found')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
