/**
 * Hourly tick — cancel Paymob orders left in pending_payment for over 1 hour.
 */
const { logger } = require('../../lib/logger');
const { captureCronFailure } = require('../../lib/sentry');
const {
  cancelExpiredPendingOrders,
  DEFAULT_MAX_AGE_MS,
} = require('../../lib/pendingOrderExpiry');

let intervalHandle = null;

function startPendingOrderExpiryScheduler() {
  if (intervalHandle) return intervalHandle;

  const intervalMs = Math.max(
    5 * 60 * 1000,
    Number(process.env.PENDING_ORDER_EXPIRY_INTERVAL_MS || 15 * 60 * 1000)
  );
  const maxAgeMs = Math.max(
    15 * 60 * 1000,
    Number(process.env.PENDING_ORDER_EXPIRY_MS || DEFAULT_MAX_AGE_MS)
  );

  const tick = () => {
    void cancelExpiredPendingOrders(maxAgeMs).catch((err) => {
      logger.error({ err: err.message }, 'pending order expiry tick failed');
      captureCronFailure('pending-order-expiry', err, { scheduler: true });
    });
  };

  intervalHandle = setInterval(tick, intervalMs);
  tick();

  logger.info({ intervalMs, maxAgeMs }, 'Pending order expiry scheduler started');
  return intervalHandle;
}

function stopPendingOrderExpiryScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

function isPendingOrderExpirySchedulerRunning() {
  return intervalHandle != null;
}

module.exports = {
  startPendingOrderExpiryScheduler,
  stopPendingOrderExpiryScheduler,
  isPendingOrderExpirySchedulerRunning,
};
