/**
 * Nutrition routes — food library, food logging, daily summaries.
 *
 *   GET    /api/nutrition/foods?search=&category=
 *   GET    /api/nutrition/foods/:id
 *   POST   /api/nutrition/logs                  body: { foodItemId, grams, loggedAt? }
 *   GET    /api/nutrition/logs/me?date=YYYY-MM-DD
 *   DELETE /api/nutrition/logs/:id
 *   GET    /api/nutrition/summary?date=YYYY-MM-DD
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
router.use(authMiddleware);

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const searchSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    category: z.string().optional(),
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

router.get('/foods', validate(searchSchema), async (req, res, next) => {
  try {
    const { search, category } = req.query;
    const where = { isPublic: true };
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (category) where.category = category;
    const items = await prisma.foodItem.findMany({ where, orderBy: { name: 'asc' }, take: 200 });
    res.json(items);
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
