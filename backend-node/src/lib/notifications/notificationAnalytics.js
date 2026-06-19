/**
 * Track notification engagement events for analytics.
 */
const { prisma } = require('../../db');

const EVENTS = ['opened', 'clicked', 'dismissed', 'accepted', 'declined', 'snoozed'];

async function trackNotificationEvent({ userId, notificationId, event, metadata = null }) {
  if (!userId || !notificationId || !event) return null;
  if (!EVENTS.includes(event)) return null;
  try {
    const { randomUUID } = require('crypto');
    return prisma.notificationEvent.create({
      data: {
        id: randomUUID(),
        userId,
        notificationId,
        event,
        metadata: metadata || undefined,
      },
    });
  } catch {
    return null;
  }
}

module.exports = { trackNotificationEvent, EVENTS };
