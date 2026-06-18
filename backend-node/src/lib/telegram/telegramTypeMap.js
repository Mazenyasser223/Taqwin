/**
 * Telegram delivery rules — which in-app notification types may be sent externally.
 */
const { PRIORITIES } = require('../notifications/notificationConstants');

/** Never send to Telegram — in-app only */
const TELEGRAM_BLOCKED_PREFIXES = [
  'community.reaction',
  'community.like',
  'community.story_',
  'community.ring',
  'community.comment_reaction',
  'gamification.xp_',
  'gamification.coin_',
  'gamification.achievement',
  'promo.',
];

/** Always deliver immediately; does not count toward daily cap */
const TELEGRAM_CRITICAL_PREFIXES = [
  'support.',
  'auth.',
  'coach.feedback_available',
  'ai.adaptation_applied',
  'ai.adaptation_macro',
  'order.awaiting_payment',
  'order.payment_failed',
  'subscription.',
];

const TELEGRAM_CRITICAL_EXACT = new Set([
  'fitness.recovery_critical',
]);

/** type prefix → UserSettings preference field */
const TYPE_PREF_MAP = [
  { prefix: 'auth.', pref: 'telegramSecurityAlerts' },
  { prefix: 'support.', pref: 'telegramSecurityAlerts' },
  { prefix: 'coach.', pref: 'telegramCoachAi' },
  { prefix: 'ai.', pref: 'telegramCoachAi' },
  { prefix: 'fitness.coach_feedback', pref: 'telegramCoachAi' },
  { prefix: 'fitness.daily_digest', pref: 'telegramDailyDigest' },
  { prefix: 'fitness.weekly_summary', pref: 'telegramWeeklySummary' },
  { prefix: 'fitness.ai_insight', pref: 'telegramAiInsights' },
  { prefix: 'fitness.recovery_changed', pref: 'telegramAiInsights' },
  { prefix: 'fitness.recovery_critical', pref: 'telegramAiInsights' },
  { prefix: 'fitness.weight_trend', pref: 'telegramAiInsights' },
  { prefix: 'fitness.heart_rate_anomaly', pref: 'telegramAiInsights' },
  { prefix: 'fitness.pr_achieved', pref: 'telegramFitnessAchievements' },
  { prefix: 'fitness.streak_milestone', pref: 'telegramFitnessAchievements' },
  { prefix: 'fitness.workout_missed', pref: 'telegramWorkoutMissed' },
  { prefix: 'fitness.hydration_goal', pref: 'telegramFitnessAchievements' },
  { prefix: 'fitness.macro_target', pref: 'telegramFitnessAchievements' },
  { prefix: 'plan.meal_reminder', pref: 'telegramMealReminders' },
  { prefix: 'workout.reminder', pref: null }, // blocked unless workout_missed
  { prefix: 'gamification.challenge.', pref: 'telegramFitnessAchievements' },
  { prefix: 'gamification.duel.', pref: 'telegramFitnessAchievements' },
  { prefix: 'order.', pref: 'telegramOrders' },
  { prefix: 'community.follow', pref: 'telegramSocialActivity' },
  { prefix: 'community.mention', pref: 'telegramSocialActivity' },
  { prefix: 'community.story_mention', pref: 'telegramSocialActivity' },
  { prefix: 'community.comment', pref: 'telegramCommunityComments' },
  { prefix: 'community.comment_reply', pref: 'telegramCommunityComments' },
  { prefix: 'community.message', pref: 'telegramCommunityMessages' },
  { prefix: 'community.message_request', pref: 'telegramCommunityMessages' },
  { prefix: 'community.group_invite', pref: 'telegramCommunityMessages' },
  { prefix: 'community.group_join_request', pref: 'telegramCommunityMessages' },
  { prefix: 'community.follow_request', pref: 'telegramCommunityMessages' },
];

function isBlockedType(type) {
  if (!type) return true;
  if (type === 'fitness.workout_missed') return false;
  if (type === 'fitness.daily_digest' || type === 'fitness.weekly_summary') return false;
  for (const prefix of TELEGRAM_BLOCKED_PREFIXES) {
    if (type.startsWith(prefix) || type === prefix) return true;
  }
  if (type === 'workout.reminder') return true;
  return false;
}

function isCriticalType(type, row = {}) {
  if (!type) return false;
  if (TELEGRAM_CRITICAL_EXACT.has(type)) return true;
  for (const prefix of TELEGRAM_CRITICAL_PREFIXES) {
    if (type.startsWith(prefix) || type === prefix) return true;
  }
  if (type === 'fitness.recovery_changed') {
    const payload = row.payload || {};
    const score = Number(payload.score);
    const prev = Number(payload.previousScore);
    const delta = Number(payload.delta);
    if (Number.isFinite(score) && score < 65) return true;
    if (Number.isFinite(prev) && Number.isFinite(delta) && delta <= -15) return true;
  }
  if (row.priority === PRIORITIES.URGENT) return true;
  return false;
}

function prefKeyForTelegramType(type) {
  if (!type) return null;
  for (const row of TYPE_PREF_MAP) {
    if (type.startsWith(row.prefix) || type === row.prefix) return row.pref;
  }
  return 'telegramAiInsights';
}

function isAllowedByPrefs(type, settings) {
  if (!settings?.telegramEnabled) return false;
  const pref = prefKeyForTelegramType(type);
  if (pref === null) return false;
  if (!pref) return true;
  return Boolean(settings[pref]);
}

module.exports = {
  TELEGRAM_BLOCKED_PREFIXES,
  TELEGRAM_CRITICAL_PREFIXES,
  isBlockedType,
  isCriticalType,
  prefKeyForTelegramType,
  isAllowedByPrefs,
};
