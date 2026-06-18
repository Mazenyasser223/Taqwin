/**
 * Notification lifecycle — expire, archive, batch cleanup.
 */
const { prisma } = require('../../db');
const { logger } = require('../logger');
const { ARCHIVE_AFTER_DAYS } = require('./notificationConstants');
const { flushPendingNotifications } = require('./notificationQuietHours');

async function expireNotifications(limit = 2000) {
  const now = new Date();
  const rows = await prisma.notification.findMany({
    where: { expiresAt: { lte: now }, deletedAt: null },
    select: { id: true },
    take: limit,
  });
  if (rows.length === 0) return { expired: 0 };

  const upd = await prisma.notification.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { deletedAt: now },
  });
  return { expired: upd.count };
}

async function archiveOldNotifications(days = ARCHIVE_AFTER_DAYS, limit = 5000) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const rows = await prisma.notification.findMany({
    where: {
      createdAt: { lt: cutoff },
      archivedAt: null,
      deletedAt: null,
    },
    select: { id: true },
    take: limit,
  });
  if (rows.length === 0) return { archived: 0 };
  const now = new Date();
  const upd = await prisma.notification.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { archivedAt: now },
  });
  return { archived: upd.count };
}

async function runNotificationMaintenance(opts = {}) {
  const expired = await expireNotifications(opts.expireLimit || 2000);
  const archived = await archiveOldNotifications(opts.archiveDays || ARCHIVE_AFTER_DAYS);
  const pending = await flushPendingNotifications(opts.pendingLimit || 500);
  if (expired.expired > 0 || archived.archived > 0 || pending.flushed > 0) {
    logger.info({ ...expired, ...archived, ...pending }, 'notification maintenance');
  }
  return { ...expired, ...archived, ...pending };
}

module.exports = { expireNotifications, archiveOldNotifications, runNotificationMaintenance };
