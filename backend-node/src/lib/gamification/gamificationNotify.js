/**
 * Gamification in-app notifications (league + challenges).
 */
const { emitNotification } = require('../notifications');
const { getOrCreateUserSettings } = require('../userSettings');

async function emitGamificationNotification({ userId, type, params = {}, link = null }) {
  if (!userId || !type) return null;

  const settings = await getOrCreateUserSettings(userId);
  if (type.startsWith('gamification.league.') && !settings.leagueOptIn) return null;
  if (type.startsWith('gamification.challenge.') && settings.challengeNotifications === false) {
    return null;
  }
  if (
    (type.startsWith('gamification.duel.') || type.startsWith('gamification.squad.')) &&
    settings.challengeNotifications === false
  ) {
    return null;
  }

  return emitNotification({
    userId,
    type,
    link,
    payload: params,
    icon: 'emoji_events',
  });
}

module.exports = {
  emitGamificationNotification,
};
