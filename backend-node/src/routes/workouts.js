/**
 * Workout routes — library, logging, and trainer authoring.
 *
 *   GET   /api/workouts?category=&difficulty=&search=
 *   GET   /api/workouts/:id
 *   POST  /api/workouts/logs                  (any user)
 *   GET   /api/workouts/logs/me
 *   POST  /api/workouts                       (trainer)
 *   PATCH /api/workouts/:id                   (trainer, author only)
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
router.use(authMiddleware);

const listSchema = z.object({
  query: z.object({
    category: z.string().optional(),
    difficulty: z.string().optional(),
    search: z.string().optional(),
  }),
});

const idParam = z.object({ params: z.object({ id: z.string().uuid() }) });

const createSchema = z.object({
  body: z.object({
    title: z.string().min(2).max(120),
    category: z.enum(['Strength', 'Yoga', 'Cardio', 'Recovery', 'HIIT', 'Mobility']),
    difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']),
    durationMin: z.number().int().positive().max(600),
    calories: z.number().int().nonnegative().max(5000),
    imageUrl: z.string().url().optional(),
    description: z.string().max(4000).optional(),
    isPublic: z.boolean().optional(),
  }),
});

const updateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: createSchema.shape.body.partial(),
});

const logSchema = z.object({
  body: z.object({
    workoutId: z.string().uuid(),
    durationMin: z.number().int().positive().max(600).optional(),
    notes: z.string().max(1000).optional(),
  }),
});

router.get('/', validate(listSchema), async (req, res, next) => {
  try {
    const { category, difficulty, search } = req.query;
    const where = { isPublic: true };
    if (category) where.category = category;
    if (difficulty) where.difficulty = difficulty;
    if (search) where.title = { contains: search, mode: 'insensitive' };
    const workouts = await prisma.workout.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
      },
    });
    res.json(workouts);
  } catch (err) {
    next(err);
  }
});

router.get('/logs/me', async (req, res, next) => {
  try {
    const logs = await prisma.workoutLog.findMany({
      where: { userId: req.user.id },
      include: { workout: true },
      orderBy: { loggedAt: 'desc' },
      take: 100,
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

router.post('/logs', validate(logSchema), async (req, res, next) => {
  try {
    const workout = await prisma.workout.findUnique({ where: { id: req.body.workoutId } });
    if (!workout) return res.status(404).json({ error: 'Workout not found' });
    const log = await prisma.workoutLog.create({
      data: {
        userId: req.user.id,
        workoutId: req.body.workoutId,
        durationMin: req.body.durationMin ?? workout.durationMin,
        notes: req.body.notes ?? null,
      },
      include: { workout: true },
    });
    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('trainer'), validate(createSchema), async (req, res, next) => {
  try {
    const workout = await prisma.workout.create({
      data: { ...req.body, createdById: req.user.id },
    });
    res.status(201).json(workout);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', validate(idParam), async (req, res, next) => {
  try {
    const workout = await prisma.workout.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
      },
    });
    if (!workout) return res.status(404).json({ error: 'Workout not found' });
    res.json(workout);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireRole('trainer'), validate(updateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.workout.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Workout not found' });
    if (existing.createdById !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this workout' });
    }
    const workout = await prisma.workout.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(workout);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
