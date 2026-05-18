/**
 * Notification helper — emits a row into the `notifications` table.
 * Fire-and-forget; we never block the parent request on this.
 */
const { prisma } = require('../db');
const { logger } = require('./logger');

async function emitNotification({ userId, type, title, message, link }) {
  if (!userId || !type || !title || !message) return null;
  try {
    return await prisma.notification.create({
      data: { userId, type, title, message, link: link || null },
    });
  } catch (err) {
    logger.warn({ err, userId, type }, 'Failed to emit notification');
    return null;
  }
}

module.exports = { emitNotification };
