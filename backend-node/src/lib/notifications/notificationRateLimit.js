/**
 * Abuse protection — hourly/daily caps for noisy social notification types.
 */
const { inc } = require('./notificationMetrics');

/** type → { hour?: number, day?: number } max emit attempts per recipient per window */
const LIMITS = {
  'community.reaction': { hour: 120, day: 500 },
  'community.comment': { hour: 80, day: 300 },
  'community.comment_reply': { hour: 80, day: 300 },
  'community.mention': { hour: 40, day: 150 },
  'community.story_mention': { hour: 40, day: 150 },
  'community.message': { hour: 60, day: 250 },
  'community.message_request': { hour: 30, day: 100 },
  'community.group_invite': { hour: 20, day: 50 },
};

function limitsForType(type) {
  if (LIMITS[type]) return LIMITS[type];
  return null;
}

module.exports = { limitsForType, LIMITS };
