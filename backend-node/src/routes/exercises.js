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
const { parseExerciseLogNotes, encodeExerciseLogNotes } = require('../lib/exerciseLogNotes');

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

router.get('/logs/me', validate(dateSchema), async (req, res, next) => {
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

router.patch('/logs/:id', validate(logUpdateSchema), async (req, res, next) => {
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

router.delete('/logs/:id', validate(idParam), async (req, res, next) => {
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

router.post('/plan/log', validate(planExerciseLogSchema), async (req, res, next) => {
  try {
    const locale = parseLocale(req.query);
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
