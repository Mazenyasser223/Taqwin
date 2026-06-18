/**
 * Abuse protection — atomic per-window emit counters (works with grouped updates).
 */
const { prisma } = require('../../db');
const { inc } = require('./notificationMetrics');
const { limitsForType } = require('./notificationRateLimit');

function hourWindowKey(now = new Date()) {
  return `hour:${now.toISOString().slice(0, 13)}`;
}

function dayWindowKey(now = new Date()) {
  return `day:${now.toISOString().slice(0, 10)}`;
}

async function readCounter(userId, type, windowKey) {
  const row = await prisma.notificationEmitCounter.findUnique({
    where: { userId_type_windowKey: { userId, type, windowKey } },
  });
  return row?.count || 0;
}

/**
 * Reserve one emit slot; returns false when over limit.
 */
async function acquireEmitSlot(userId, type) {
  const lim = limitsForType(type);
  if (!lim) return true;

  const now = new Date();
  const windows = [];
  if (lim.hour) windows.push({ key: hourWindowKey(now), max: lim.hour });
  if (lim.day) windows.push({ key: dayWindowKey(now), max: lim.day });

  for (const w of windows) {
    const current = await readCounter(userId, type, w.key);
    if (current >= w.max) {
      inc('rateLimited');
      return false;
    }
  }

  for (const w of windows) {
    await prisma.notificationEmitCounter.upsert({
      where: { userId_type_windowKey: { userId, type, windowKey: w.key } },
      create: { userId, type, windowKey: w.key, count: 1 },
      update: { count: { increment: 1 } },
    });
  }

  return true;
}

module.exports = { acquireEmitSlot, hourWindowKey, dayWindowKey };
