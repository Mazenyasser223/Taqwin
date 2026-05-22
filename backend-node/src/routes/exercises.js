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
    const logs = await prisma.exerciseLog.findMany({
      where: { userId: req.user.id },
      include: { exercise: true },
      orderBy: { loggedAt: 'desc' },
      take: 50,
    });
    res.json(
      logs.map((log) => ({
        ...log,
        exercise: log.exercise ? normalizeExercise(log.exercise) : null,
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
    const labels = muscleLabelsForZone(muscle);

  if (labels) {
      const rows = await prisma.$queryRaw`
        SELECT *
        FROM exercises
        WHERE is_public = true
        ${category ? Prisma.sql`AND category = ${category}` : Prisma.empty}
        AND ${muscleOverlapSql(labels)}
        ${searchTerm ? Prisma.sql`AND name ILIKE ${`%${searchTerm}%`}` : Prisma.empty}
      ORDER BY name ASC
      LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}
      `;

      const countRows = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS count
        FROM exercises
        WHERE is_public = true
        ${category ? Prisma.sql`AND category = ${category}` : Prisma.empty}
        AND ${muscleOverlapSql(labels)}
        ${searchTerm ? Prisma.sql`AND name ILIKE ${`%${searchTerm}%`}` : Prisma.empty}
      `;

      const total = Number(countRows[0]?.count ?? 0);
      return res.json({
        items: rows.map(normalizeExercise),
        page,
        pageSize,
        total,
        hasMore: offset + rows.length < total,
      });
    }

    const where = {
      isPublic: true,
      ...(category ? { category } : {}),
      ...(searchTerm ? { name: { contains: searchTerm, mode: 'insensitive' } } : {}),
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

    res.json({
      items: rows.map(normalizeExercise),
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
    const exercise = await prisma.exercise.findFirst({
      where: { id: req.params.id, isPublic: true },
    });
    if (!exercise) return res.status(404).json({ error: 'Exercise not found' });
    res.json(normalizeExercise(exercise));
  } catch (err) {
    next(err);
  }
});

router.post('/logs', validate(logSchema), async (req, res, next) => {
  try {
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
      exercise: normalizeExercise(log.exercise),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
