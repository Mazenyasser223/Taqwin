/**
 * Notification routes.
 *
 *   GET    /api/notifications              — cursor paginated list + filters
 *   POST   /api/notifications/seen         — mark visible as seen (drawer open)
 *   POST   /api/notifications/:id/read     — mark one read
 *   POST   /api/notifications/read-all     — mark all read
 *   POST   /api/notifications/:id/action   — execute action (accept/decline/snooze)
 *   POST   /api/notifications/:id/event    — analytics event
 *   DELETE /api/notifications/:id            — soft delete
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { snoozeNotification } = require('../lib/notifications');
const { trackNotificationEvent } = require('../lib/notifications/notificationAnalytics');
const { serializeNotification, enrichActors } = require('../lib/notifications/notificationSerialize');
const {
  buildListWhere,
  buildUnreadWhere,
  categoryNeedsRepair,
  categoryForType,
} = require('../lib/notifications/notificationListFilters');

const router = express.Router();
router.use(authMiddleware);

const idParam = z.object({ params: z.object({ id: z.string().uuid() }) });

const listQuery = z.object({
  query: z.object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    category: z
      .enum(['SOCIAL', 'WORKOUT', 'AI', 'SHOP', 'SUPPORT', 'GYM', 'SYSTEM', 'ALL', 'UNREAD'])
      .optional(),
  }),
});

const actionBody = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ action: z.string().min(1) }),
});

const eventBody = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    event: z.enum(['opened', 'clicked', 'dismissed', 'accepted', 'declined', 'snoozed']),
    metadata: z.record(z.unknown()).optional(),
  }),
});

async function repairStaleCategories(userId) {
  const stale = await prisma.notification.findMany({
    where: { userId, deletedAt: null },
    select: { id: true, type: true, category: true },
    take: 200,
    orderBy: { createdAt: 'desc' },
  });
  const fixes = stale.filter(categoryNeedsRepair);
  if (!fixes.length) return 0;
  await Promise.all(
    fixes.map((row) =>
      prisma.notification.update({
        where: { id: row.id },
        data: { category: categoryForType(row.type) },
      }),
    ),
  );
  return fixes.length;
}

router.get('/unread-count', async (req, res, next) => {
  try {
    const unread = await prisma.notification.count({
      where: buildUnreadWhere(req.user.id),
    });
    res.json({ unread });
  } catch (err) {
    next(err);
  }
});

router.get('/', validate(listQuery), async (req, res, next) => {
  try {
    await repairStaleCategories(req.user.id);
    const limit = req.query.limit || 30;
    const category = req.query.category || 'ALL';
    const where = buildListWhere(req.user.id, category);

    if (req.query.cursor) {
      const cursorRow = await prisma.notification.findUnique({ where: { id: req.query.cursor } });
      if (cursorRow && cursorRow.userId === req.user.id) {
        where.createdAt = { lt: cursorRow.createdAt };
      }
    }

    const items = await prisma.notification.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: limit + 1,
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const actorMap = await enrichActors(prisma, page);
    const nextCursor = hasMore ? page[page.length - 1]?.id : null;

    res.json({
      items: page.map((n) => serializeNotification(n, actorMap)),
      nextCursor,
      hasMore,
    });
  } catch (err) {
    next(err);
  }
});

async function pushSyncEvent(userId, type, payload) {
  try {
    const { pushRealtime } = require('../realtime/publish');
    void pushRealtime(userId, { type, ...payload, ts: Date.now() });
  } catch {
    /* optional */
  }
}

router.post('/seen', async (req, res, next) => {
  try {
    const now = new Date();
    const result = await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        deletedAt: null,
        seenAt: null,
        readAt: null,
      },
      data: { seenAt: now },
    });
    if (result.count > 0) {
      await pushSyncEvent(req.user.id, 'notification.seen', { seenAt: now.toISOString() });
    }
    res.json({ updated: result.count, seenAt: now.toISOString() });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/read', validate(idParam), async (req, res, next) => {
  try {
    const notif = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    if (notif.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const now = new Date();
    const updated = await prisma.notification.update({
      where: { id: notif.id },
      data: { read: true, readAt: now, seenAt: notif.seenAt || now },
    });
    const serialized = serializeNotification(updated);
    await pushSyncEvent(req.user.id, 'notification.read', { notification: serialized });
    res.json(serialized);
  } catch (err) {
    next(err);
  }
});

router.post('/read-all', async (req, res, next) => {
  try {
    const now = new Date();
    const result = await prisma.notification.updateMany({
      where: { userId: req.user.id, readAt: null, deletedAt: null },
      data: { read: true, readAt: now, seenAt: now },
    });
    await pushSyncEvent(req.user.id, 'notification.read_all', { readAt: now.toISOString(), updated: result.count });
    res.json({ updated: result.count, readAt: now.toISOString() });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/action', validate(actionBody), async (req, res, next) => {
  try {
    const notif = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    if (notif.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const action = req.body.action;
    const payload = (notif.payload && typeof notif.payload === 'object' ? notif.payload : {}) || {};
    let result = { ok: true };

    if (action === 'snooze.15m') {
      const until = new Date(Date.now() + 15 * 60 * 1000);
      await snoozeNotification(notif.id, req.user.id, until);
      result = { ok: true, snoozedUntil: until.toISOString() };
    } else if (action === 'snooze.1h') {
      const until = new Date(Date.now() + 60 * 60 * 1000);
      await snoozeNotification(notif.id, req.user.id, until);
      result = { ok: true, snoozedUntil: until.toISOString() };
    } else if (action === 'snooze.tomorrow') {
      const until = new Date();
      until.setDate(until.getDate() + 1);
      until.setHours(8, 0, 0, 0);
      await snoozeNotification(notif.id, req.user.id, until);
      result = { ok: true, snoozedUntil: until.toISOString() };
    } else {
      result = { ok: true, action, delegated: true, payload };
    }

    void trackNotificationEvent({
      userId: req.user.id,
      notificationId: notif.id,
      event: action.includes('decline') ? 'declined' : action.includes('accept') ? 'accepted' : 'clicked',
      metadata: { action },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/event', validate(eventBody), async (req, res, next) => {
  try {
    const notif = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    if (notif.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    await trackNotificationEvent({
      userId: req.user.id,
      notificationId: notif.id,
      event: req.body.event,
      metadata: req.body.metadata,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', validate(idParam), async (req, res, next) => {
  try {
    const notif = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    if (notif.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const now = new Date();
    await prisma.notification.update({
      where: { id: notif.id },
      data: { deletedAt: now },
    });
    await pushSyncEvent(req.user.id, 'notification.deleted', { id: notif.id, deletedAt: now.toISOString() });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
