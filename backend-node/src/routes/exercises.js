/**
 * Exercise catalog — MuscleWiki data in Postgres.
 *
 *   GET  /api/exercises?category=&muscle=&search=&page=&pageSize=
 *   GET  /api/exercises/categories
 *   GET  /api/exercises/muscle-counts
 *   GET  /api/exercises/:id
 *   POST /api/exercises/logs
 *   GET  /api/exercises/logs/me
 */
const express = require('express');
const { randomUUID } = require('crypto');
const { z } = require('zod');
const { Prisma } = require('@prisma/client');
const { prisma } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { muscleLabelsForZone, normalizeExercise, MUSCLE_ZONE_TO_LABELS } = require('../lib/exerciseMuscleMap');
const { ensureExercisesNameAr, ensureExerciseNameAr } = require('../lib/exerciseNameAr');

function parseLocale(query) {
  return query?.locale === 'en' ? 'en' : 'ar';
}

const router = express.Router();
router.use(authMiddleware);

const listSchema = z.object({
  category: z.string().optional(),
  muscle: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(60).optional(),
});

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
    muscle: parsed.data.muscle,
    search: parsed.data.search?.trim() || null,
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

const idParam = z.object({ params: z.object({ id: z.string().min(1) }) });

const logSchema = z.object({
  body: z.object({
    exerciseId: z.string().min(1),
    notes: z.string().max(1000).optional(),
  }),
});

function muscleOverlapSql(labels) {
  return Prisma.sql`primary_muscles ?| ARRAY[${Prisma.join(labels.map((l) => Prisma.sql`${l}`))}]::text[]`;
}

router.get('/categories', async (_req, res, next) => {
  try {
    const grouped = await prisma.exercise.groupBy({
      by: ['category'],
      where: { isPublic: true },
      _count: { category: true },
      orderBy: { _count: { category: 'desc' } },
    });
    res.json(
      grouped.map((row) => ({
        category: row.category,
        count: row._count.category,
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.get('/muscle-counts', async (_req, res, next) => {
  try {
    const zones = Object.keys(MUSCLE_ZONE_TO_LABELS);
    const counts = {};
    for (const zone of zones) {
      const labels = muscleLabelsForZone(zone);
      const rows = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS count
        FROM exercises
        WHERE is_public = true
        AND ${muscleOverlapSql(labels)}
      `;
      counts[zone] = rows[0]?.count ?? 0;
    }
    res.json(counts);
  } catch (err) {
    next(err);
  }
});

router.get('/logs/me', async (req, res, next) => {
  try {
    const locale = parseLocale(req.query);
    const logs = await prisma.exerciseLog.findMany({
      where: { userId: req.user.id },
      include: { exercise: true },
      orderBy: { loggedAt: 'desc' },
      take: 50,
    });
    const enriched =
      locale === 'ar'
        ? await ensureExercisesNameAr(
            logs.map((l) => l.exercise).filter(Boolean),
            prisma,
            { max: 50 },
          )
        : [];
    const byId = new Map(enriched.map((e) => [e.id, e]));
    res.json(
      logs.map((log) => ({
        ...log,
        exercise: log.exercise
          ? normalizeExercise(byId.get(log.exercise.id) ?? log.exercise, locale)
          : null,
      })),
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

    const { category, muscle, search: searchTerm, page, pageSize, offset } = q;
    const locale = parseLocale(req.query);
    const labels = muscleLabelsForZone(muscle);

  if (labels) {
      const searchSql = searchTerm
        ? locale === 'ar'
          ? Prisma.sql`AND (name ILIKE ${`%${searchTerm}%`} OR name_ar ILIKE ${`%${searchTerm}%`})`
          : Prisma.sql`AND name ILIKE ${`%${searchTerm}%`}`
        : Prisma.empty;

      const rows = await prisma.$queryRaw`
        SELECT *
        FROM exercises
        WHERE is_public = true
        ${category ? Prisma.sql`AND category = ${category}` : Prisma.empty}
        AND ${muscleOverlapSql(labels)}
        ${searchSql}
      ORDER BY name ASC
      LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}
      `;

      const countRows = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS count
        FROM exercises
        WHERE is_public = true
        ${category ? Prisma.sql`AND category = ${category}` : Prisma.empty}
        AND ${muscleOverlapSql(labels)}
        ${searchSql}
      `;

      const total = Number(countRows[0]?.count ?? 0);
      const withAr =
        locale === 'ar' ? await ensureExercisesNameAr(rows, prisma, { max: pageSize }) : rows;
      return res.json({
        items: withAr.map((row) => normalizeExercise(row, locale)),
        page,
        pageSize,
        total,
        hasMore: offset + rows.length < total,
      });
    }

    const where = {
      isPublic: true,
      ...(category ? { category } : {}),
      ...(searchTerm
        ? locale === 'ar'
          ? {
              OR: [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { nameAr: { contains: searchTerm, mode: 'insensitive' } },
              ],
            }
          : { name: { contains: searchTerm, mode: 'insensitive' } }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.exercise.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: Number(offset),
        take: Number(pageSize),
      }),
      prisma.exercise.count({ where }),
    ]);

    const withAr =
      locale === 'ar' ? await ensureExercisesNameAr(rows, prisma, { max: pageSize }) : rows;

    res.json({
      items: withAr.map((row) => normalizeExercise(row, locale)),
      page,
      pageSize,
      total,
      hasMore: offset + rows.length < total,
    });
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

router.post('/logs', validate(logSchema), async (req, res, next) => {
  try {
    const locale = parseLocale(req.query);
    const exercise = await prisma.exercise.findFirst({
      where: { id: req.body.exerciseId, isPublic: true },
    });
    if (!exercise) return res.status(404).json({ error: 'Exercise not found' });

    const log = await prisma.exerciseLog.create({
      data: {
        id: randomUUID(),
        userId: req.user.id,
        exerciseId: req.body.exerciseId,
        notes: req.body.notes,
      },
      include: { exercise: true },
    });
    res.status(201).json({
      ...log,
      exercise: normalizeExercise(
        locale === 'ar' ? await ensureExerciseNameAr(log.exercise, prisma) : log.exercise,
        locale,
      ),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
