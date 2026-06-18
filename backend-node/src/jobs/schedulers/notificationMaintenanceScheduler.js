/**
 * Notification maintenance — expire, archive, flush quiet-hours queue.
 */
const { logger } = require('../../lib/logger');
const { runNotificationMaintenance } = require('../../lib/notifications/notificationMaintenance');

let intervalHandle = null;

function isNotificationMaintenanceEnabled() {
  const flag = (process.env.FEATURE_NOTIFICATION_MAINTENANCE || '').toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'yes' || process.env.NODE_ENV === 'production';
}

async function tickNotificationMaintenance() {
  const result = await runNotificationMaintenance({});
  if (result.expired > 0 || result.archived > 0 || result.flushed > 0) {
    logger.info(result, 'notification maintenance tick');
  }
}

function startNotificationMaintenanceScheduler() {
  if (!isNotificationMaintenanceEnabled()) {
    logger.info('Notification maintenance scheduler disabled');
    return null;
  }
  if (intervalHandle) return intervalHandle;

  const intervalMs = Math.max(
    15 * 60 * 1000,
    Number(process.env.NOTIFICATION_MAINTENANCE_INTERVAL_MS || 3600000)
  );

  intervalHandle = setInterval(() => {
    void tickNotificationMaintenance().catch((err) => {
      logger.error({ err: err.message }, 'notification maintenance failed');
    });
  }, intervalMs);

  void tickNotificationMaintenance().catch((err) => {
    logger.error({ err: err.message }, 'notification maintenance initial tick failed');
  });

  logger.info({ intervalMs }, 'Notification maintenance scheduler started');
  return intervalHandle;
}

function stopNotificationMaintenanceScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  startNotificationMaintenanceScheduler,
  stopNotificationMaintenanceScheduler,
  tickNotificationMaintenance,
};
