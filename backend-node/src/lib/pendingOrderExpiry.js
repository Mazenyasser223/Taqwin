/**
 * Cancel marketplace orders that were never paid within the expiry window.
 */
const { prisma } = require('../db');
const { logger } = require('./logger');

const DEFAULT_MAX_AGE_MS = 60 * 60 * 1000;

async function cancelExpiredPendingOrders(maxAgeMs = DEFAULT_MAX_AGE_MS) {
  const cutoff = new Date(Date.now() - maxAgeMs);

  const expired = await prisma.order.findMany({
    where: {
      paymentStatus: 'pending',
      status: 'pending_payment',
      createdAt: { lt: cutoff },
    },
    select: { id: true },
  });

  if (expired.length === 0) {
    return { cancelled: 0, scanned: 0 };
  }

  const result = await prisma.order.updateMany({
    where: {
      id: { in: expired.map((row) => row.id) },
      paymentStatus: 'pending',
      status: 'pending_payment',
    },
    data: {
      paymentStatus: 'failed',
      status: 'cancelled',
    },
  });

  if (result.count > 0) {
    logger.info({ cancelled: result.count, maxAgeMs }, 'Expired pending marketplace orders cancelled');
  }

  return { cancelled: result.count, scanned: expired.length };
}

module.exports = { cancelExpiredPendingOrders, DEFAULT_MAX_AGE_MS };
