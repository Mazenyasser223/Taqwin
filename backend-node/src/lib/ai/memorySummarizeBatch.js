/**
 * Block E4 — batch enqueue nightly memory summarization.
 */
const { prisma } = require('../../db');
const { logger } = require('../logger');
const { isMongoConfigured, connectMongo } = require('../../db/mongo/client');
const { isPlanQueueEnabled } = require('../redisBull');
const { enqueueMemorySummarize, MEMORY_SOURCES } = require('./memoryEvents');

function isMemoryCronWindowForTimezone(timezone, now = new Date()) {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    const hour = Number(fmt.formatToParts(now).find((p) => p.type === 'hour')?.value ?? 99);
    return hour >= 2 && hour < 5;
  } catch {
    return now.getUTCHours() >= 2 && now.getUTCHours() < 5;
  }
}

async function listUsersWithRecentChat({ hours = 48, limit = 500 } = {}) {
  if (!isMongoConfigured()) return [];
  await connectMongo();
  const Message = require('../../db/mongo/models/message');
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const userIds = await Message.distinct('userId', {
    role: 'user',
    createdAt: { $gte: since },
  });
  return userIds.slice(0, limit);
}

/**
 * @param {{ respectTimezoneWindow?: boolean, dryRun?: boolean, hours?: number }} [opts]
 */
async function runMemorySummarizeBatch(opts = {}) {
  const respectWindow = opts.respectTimezoneWindow !== false;
  const dryRun = Boolean(opts.dryRun);
  const hours = Number(opts.hours) || 48;

  if (!dryRun && !isPlanQueueEnabled()) {
    return { ok: false, reason: 'queue_disabled', enqueued: 0, scanned: 0 };
  }

  const userIds = await listUsersWithRecentChat({ hours });
  if (!userIds.length) {
    return { ok: true, enqueued: 0, scanned: 0, reason: 'no_chat_users' };
  }

  const athletes = await prisma.user.findMany({
    where: { id: { in: userIds }, role: 'athlete' },
    select: {
      id: true,
      settings: { select: { language: true, timezone: true } },
    },
  });

  let scanned = 0;
  let enqueued = 0;
  let skippedWindow = 0;
  const now = new Date();

  for (const u of athletes) {
    scanned += 1;
    const timezone = u.settings?.timezone || 'UTC';
    if (respectWindow && !isMemoryCronWindowForTimezone(timezone, now)) {
      skippedWindow += 1;
      continue;
    }
    const locale = u.settings?.language === 'en' ? 'en' : 'ar';
    if (dryRun) {
      enqueued += 1;
      continue;
    }
    const result = await enqueueMemorySummarize({
      userId: u.id,
      locale,
      hours,
      source: MEMORY_SOURCES.NIGHTLY_CHAT,
    });
    if (result.ok) enqueued += 1;
  }

  if (enqueued > 0) {
    logger.info({ scanned, enqueued, skippedWindow, dryRun }, 'memory summarize batch');
  }

  return { ok: true, scanned, enqueued, skippedWindow, dryRun };
}

module.exports = { runMemorySummarizeBatch, isMemoryCronWindowForTimezone, listUsersWithRecentChat };
