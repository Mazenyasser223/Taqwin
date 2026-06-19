/**
 * Quiet hours — defer non-urgent notifications until morning.
 */
const { prisma } = require('../../db');
const { PRIORITIES } = require('./notificationConstants');

function parseTimeToMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || h < 0 || h > 23) return null;
  return h * 60 + (Number.isFinite(min) ? min : 0);
}

function localMinutesNow(timezone, now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(now);
    const get = (t) => parts.find((p) => p.type === t)?.value;
    let hour = Number(get('hour'));
    if (hour === 24) hour = 0;
    return (Number.isFinite(hour) ? hour : 0) * 60 + (Number(get('minute')) || 0);
  } catch {
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }
}

function isInQuietHours(settings, now = new Date()) {
  if (!settings?.quietHoursEnabled) return false;
  const start = parseTimeToMinutes(settings.quietHoursStart);
  const end = parseTimeToMinutes(settings.quietHoursEnd);
  if (start == null || end == null) return false;
  const cur = localMinutesNow(settings.timezone || 'UTC', now);
  if (start === end) return false;
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end;
}

function nextQuietHoursEnd(settings, now = new Date()) {
  const end = parseTimeToMinutes(settings.quietHoursEnd);
  if (end == null) {
    const d = new Date(now);
    d.setHours(8, 0, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    return d;
  }
  const tz = settings.timezone || 'UTC';
  const cur = localMinutesNow(tz, now);
  const deltaMin = end > cur ? end - cur : 24 * 60 - cur + end;
  return new Date(now.getTime() + deltaMin * 60 * 1000);
}

function shouldDefer(priority, settings, now = new Date()) {
  if (!isInQuietHours(settings, now)) return false;
  return priority !== PRIORITIES.URGENT && priority !== PRIORITIES.HIGH;
}

async function queuePendingNotification(userId, data, deliverAfter) {
  const { randomUUID } = require('crypto');
  return prisma.notificationPending.create({
    data: {
      id: randomUUID(),
      userId,
      data,
      deliverAfter,
    },
  });
}

async function flushPendingNotifications(limit = 500) {
  const now = new Date();
  const pending = await prisma.notificationPending.findMany({
    where: { deliverAfter: { lte: now } },
    orderBy: { deliverAfter: 'asc' },
    take: limit,
  });
  if (pending.length === 0) return { flushed: 0 };

  const { emitNotificationInternal } = require('./notificationsCore');
  let flushed = 0;
  for (const row of pending) {
    try {
      const data = row.data && typeof row.data === 'object' ? row.data : {};
      await emitNotificationInternal({ ...data, userId: row.userId, _skipQuietHours: true });
      await prisma.notificationPending.delete({ where: { id: row.id } });
      flushed += 1;
    } catch {
      /* keep for retry */
    }
  }
  return { flushed };
}

module.exports = {
  isInQuietHours,
  shouldDefer,
  nextQuietHoursEnd,
  queuePendingNotification,
  flushPendingNotifications,
};
