/**
 * Notification helper — respects user notification preferences.
 */
const { prisma } = require('../db');
const { logger } = require('./logger');

/** Map notification type prefix → UserSettings field */
const TYPE_TO_PREF = [
  { prefix: 'support.', pref: null },
  { prefix: 'auth.', pref: null },
  { prefix: 'booking.', pref: 'notifyWorkoutReminders' },
  { prefix: 'gym.', pref: 'notifyWorkoutReminders' },
  { prefix: 'workout.', pref: 'notifyWorkoutReminders' },
  { prefix: 'ai.', pref: 'notifyAiSuggestions' },
  { prefix: 'community.', pref: 'notifyAiSuggestions' },
  { prefix: 'order.', pref: 'notifyPromotional' },
  { prefix: 'promo.', pref: 'notifyPromotional' },
];

function prefKeyForType(type) {
  if (!type) return null;
  for (const row of TYPE_TO_PREF) {
    if (row.pref === null && type.startsWith(row.prefix)) return null;
    if (type.startsWith(row.prefix)) return row.pref;
  }
  return 'notifyAiSuggestions';
}

async function shouldNotifyUser(userId, type) {
  const prefKey = prefKeyForType(type);
  if (!prefKey) return true;

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings) return true;
  return Boolean(settings[prefKey]);
}

async function emitNotification({ userId, type, title, message, link }) {
  if (!userId || !type || !title || !message) return null;
  try {
    const allowed = await shouldNotifyUser(userId, type);
    if (!allowed) return null;

    return await prisma.notification.create({
      data: { userId, type, title, message, link: link || null },
    });
  } catch (err) {
    logger.warn({ err, userId, type }, 'Failed to emit notification');
    return null;
  }
}

module.exports = { emitNotification, shouldNotifyUser, prefKeyForType };
