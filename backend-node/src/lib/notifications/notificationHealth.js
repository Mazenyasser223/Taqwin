/**
 * Notification ops health — DB queue depth + in-process emit counters.
 */
const { prisma } = require('../../db');
const { snapshot } = require('./notificationMetrics');
const { isNotificationMaintenanceEnabled } = require('../../jobs/schedulers/notificationMaintenanceScheduler');
const { isSmartNotifySchedulerEnabled } = require('../../jobs/schedulers/smartNotifyScheduler');

async function getNotificationHealth() {
  const now = new Date();

  const [
    pendingTotal,
    pendingDue,
    snoozedActive,
    expiredNotDeleted,
    archivedTotal,
    telegramLinkedUsers,
  ] = await Promise.all([
    prisma.notificationPending.count(),
    prisma.notificationPending.count({ where: { deliverAfter: { lte: now } } }),
    prisma.notification.count({
      where: { snoozedUntil: { gt: now }, deletedAt: null, archivedAt: null },
    }),
    prisma.notification.count({
      where: { expiresAt: { lte: now }, deletedAt: null },
    }),
    prisma.notification.count({ where: { archivedAt: { not: null } } }),
    prisma.user.count({ where: { telegramChatId: { not: null } } }),
  ]);

  const metrics = snapshot();

  return {
    ok: true,
    at: now.toISOString(),
    metrics: {
      created: metrics.created,
      grouped: metrics.grouped,
      deduped: metrics.deduped,
      quietHoursPending: metrics.quietHoursPending,
      rateLimited: metrics.rateLimited,
      publishFailed: metrics.publishFailed,
      groupRaceRetries: metrics.groupRaceRetries,
      telegramLinkedUsers,
      telegramSentToday: metrics.telegramSentToday,
      telegramFailedToday: metrics.telegramFailedToday,
      telegramRateLimitedToday: metrics.telegramRateLimitedToday,
      countersSince: metrics.at,
    },
    queues: {
      pendingTotal,
      pendingDueNow: pendingDue,
      snoozedActive,
      expiredAwaitingCleanup: expiredNotDeleted,
      archivedTotal,
    },
    schedulers: {
      notificationMaintenance: isNotificationMaintenanceEnabled(),
      smartNotify: isSmartNotifySchedulerEnabled(),
    },
    env: {
      notificationMetricsFlushMs: process.env.NOTIFICATION_METRICS_FLUSH_MS || '300000',
      featureNotificationMaintenance: process.env.FEATURE_NOTIFICATION_MAINTENANCE || '(default: production)',
    },
  };
}

module.exports = { getNotificationHealth };
