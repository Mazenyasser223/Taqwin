/**
 * Notification routes.
 *
 *   GET   /api/notifications
 *   POST  /api/notifications/:id/read
 *   POST  /api/notifications/read-all
 *   DELETE /api/notifications/:id
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
router.use(authMiddleware);

const idParam = z.object({ params: z.object({ id: z.string().uuid() }) });

router.get('/', async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/read', validate(idParam), async (req, res, next) => {
  try {
    const notif = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    if (notif.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const updated = await prisma.notification.update({
      where: { id: notif.id },
      data: { read: true },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post('/read-all', async (req, res, next) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId: req.user.id, read: false },
      data: { read: true },
    });
    res.json({ updated: result.count });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', validate(idParam), async (req, res, next) => {
  try {
    const notif = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    if (notif.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    await prisma.notification.delete({ where: { id: notif.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
