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
  { prefix: 'plan.', pref: 'notifyAiSuggestions' },
  { prefix: 'community.', pref: 'notifyAiSuggestions' },
  { prefix: 'order.', pref: 'notifyPromotional' },
  { prefix: 'promo.', pref: 'notifyPromotional' },
  { prefix: 'gamification.challenge.', pref: 'challengeNotifications' },
  { prefix: 'gamification.league.', pref: null },
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

async function emitNotification({
  userId,
  type,
  title,
  message,
  link,
  actorId,
  actorDisplayName,
  actorAvatarUrl,
}) {
  if (!userId || !type || !title || !message) return null;
  try {
    const allowed = await shouldNotifyUser(userId, type);
    if (!allowed) return null;

    const row = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link: link || null,
        actorId: actorId || null,
        actorDisplayName: actorDisplayName || null,
        actorAvatarUrl: actorAvatarUrl || null,
      },
    });
    try {
      const { pushRealtime, notificationEnvelope } = require('../realtime/publish');
      void pushRealtime(userId, notificationEnvelope(row));
    } catch {
      /* realtime optional */
    }
    return row;
  } catch (err) {
    logger.warn({ err, userId, type }, 'Failed to emit notification');
    return null;
  }
}

module.exports = { emitNotification, shouldNotifyUser, prefKeyForType };
