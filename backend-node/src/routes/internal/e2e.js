/**
 * Internal E2E helpers — only when E2E_TEST_MODE=true (never in production).
 *
 *   POST /api/internal/e2e/ensure-user
 *   POST /api/internal/e2e/mock-telegram-link
 *   POST /api/internal/e2e/emit-notification
 *   GET  /api/internal/e2e/settings/:userId
 *   POST /api/internal/e2e/disposable-user
 *   DELETE /api/internal/e2e/disposable-user/:userId
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { validate } = require('../../middleware/validate');
const { emitNotification } = require('../../lib/notifications');
const {
  ensureE2eSettingsUser,
  mockTelegramLink,
  createDisposableUser,
  deleteUserById,
} = require('../../lib/e2e/e2eUser');
const { prisma } = require('../../db');

const router = express.Router();

function e2eGuard(req, res, next) {
  if (process.env.E2E_TEST_MODE !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }
  const secret = process.env.E2E_SECRET || process.env.AI_INTERNAL_KEY;
  if (!secret || req.headers['x-e2e-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.use(e2eGuard);

function signE2eToken(userId, email, role = 'athlete', tokenVersion = 0) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return jwt.sign({ sub: userId, email, role, tv: tokenVersion }, secret, { expiresIn: '1h' });
}

router.post('/ensure-user', async (req, res, next) => {
  try {
    const user = await ensureE2eSettingsUser();
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { tokenVersion: true, role: true },
    });
    const token = signE2eToken(user.userId, user.email, dbUser?.role || 'athlete', dbUser?.tokenVersion ?? 0);
    res.json({ ...user, token, role: dbUser?.role || 'athlete' });
  } catch (err) {
    next(err);
  }
});

router.post('/mock-telegram-link', async (req, res, next) => {
  try {
    const userId = req.body?.userId;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const result = await mockTelegramLink(userId, req.body?.chatId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const emitSchema = {
  body: z.object({
    userId: z.string().uuid(),
    type: z.string().min(3).max(128),
    title: z.string().min(1).max(200),
    message: z.string().min(1).max(500),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
    link: z.string().max(256).optional(),
  }),
};

router.post('/emit-notification', validate(emitSchema), async (req, res, next) => {
  try {
    const row = await emitNotification({
      userId: req.body.userId,
      type: req.body.type,
      title: req.body.title,
      message: req.body.message,
      link: req.body.link || '/dashboard',
      priority: req.body.priority || 'NORMAL',
      dedupeKey: `e2e:${req.body.userId}:${req.body.type}:${Date.now()}`,
      _allowCopyOverride: true,
    });
    res.json({ ok: Boolean(row), notification: row });
  } catch (err) {
    next(err);
  }
});

router.get('/settings/:userId', async (req, res, next) => {
  try {
    const settings = await prisma.userSettings.findUnique({ where: { userId: req.params.userId } });
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: { telegramChatId: true, telegramLinkedAt: true, twoFactorEnabled: true },
    });
    res.json({
      settings,
      telegramLinked: Boolean(user?.telegramChatId),
      twoFactorEnabled: Boolean(user?.twoFactorEnabled),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/disposable-user', async (req, res, next) => {
  try {
    const created = await createDisposableUser(req.body?.suffix);
    const token = signE2eToken(created.userId, created.email);
    res.json({ ...created, token });
  } catch (err) {
    next(err);
  }
});

router.delete('/disposable-user/:userId', async (req, res, next) => {
  try {
    await deleteUserById(req.params.userId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/notifications/:userId', async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        read: true,
        readAt: true,
        createdAt: true,
      },
    });
    res.json({ notifications });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
