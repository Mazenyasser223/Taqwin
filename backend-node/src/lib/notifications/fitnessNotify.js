/**
 * Taqwin fitness-specific notifications.
 */
const { emitNotification } = require('./notificationsCore');

async function emitFitnessNotification({ userId, type, payload = {}, link = '/dashboard', priority, icon, imageUrl, dedupeKey, groupKey }) {
  return emitNotification({
    userId,
    type,
    payload,
    link,
    priority,
    icon,
    imageUrl,
    dedupeKey,
    groupKey,
  });
}

async function emitStreakMilestone(userId, days) {
  return emitFitnessNotification({
    userId,
    type: 'fitness.streak_milestone',
    payload: { days, entityId: `streak-${days}` },
    link: '/dashboard',
    icon: 'local_fire_department',
    dedupeKey: `${userId}:fitness.streak_milestone:${days}`,
    priority: 'HIGH',
  });
}

async function emitPersonalRecord(userId, exerciseName, value) {
  const entityId = String(exerciseName || 'exercise')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .slice(0, 64);
  return emitFitnessNotification({
    userId,
    type: 'fitness.pr_achieved',
    payload: { exerciseName, value, entityId },
    link: '/dashboard',
    icon: 'military_tech',
    priority: 'HIGH',
    dedupeKey: `${userId}:fitness.pr_achieved:${entityId}:${value}`,
  });
}

async function emitRecoveryChanged(userId, score, extra = {}) {
  const dateKey = new Date().toISOString().slice(0, 10);
  return emitFitnessNotification({
    userId,
    type: 'fitness.recovery_changed',
    payload: { score, dateKey, ...extra },
    dedupeKey: `${userId}:fitness.recovery_changed:${dateKey}`,
    link: '/dashboard',
    icon: 'bedtime',
  });
}

async function emitHydrationGoal(userId) {
  const dateKey = new Date().toISOString().slice(0, 10);
  return emitFitnessNotification({
    userId,
    type: 'fitness.hydration_goal',
    payload: { dateKey },
    dedupeKey: `${userId}:fitness.hydration_goal:${dateKey}`,
  });
}

async function emitWeeklySummary(userId, summary, weekKey) {
  const key = weekKey || new Date().toISOString().slice(0, 10);
  return emitFitnessNotification({
    userId,
    type: 'fitness.weekly_summary',
    payload: { summary, dateKey: key },
    dedupeKey: `${userId}:fitness.weekly_summary:${key}`,
    link: '/dashboard',
    icon: 'trending_up',
  });
}

async function emitCoachFeedbackAvailable(userId, message, opts = {}) {
  const weekKey = opts.weekKey || new Date().toISOString().slice(0, 10);
  return emitFitnessNotification({
    userId,
    type: 'coach.feedback_available',
    payload: { message, weekKey, coachMessage: message },
    link: opts.link || '/dashboard?weeklyReview=1',
    priority: 'HIGH',
    icon: 'groups',
    dedupeKey: `${userId}:coach.feedback_available:${weekKey}`,
  });
}

async function emitCoachFeedback(userId, message) {
  return emitCoachFeedbackAvailable(userId, message);
}

async function emitMacroTarget(userId) {
  const dateKey = new Date().toISOString().slice(0, 10);
  return emitFitnessNotification({
    userId,
    type: 'fitness.macro_target',
    payload: { dateKey },
    dedupeKey: `${userId}:fitness.macro_target:${dateKey}`,
  });
}

async function emitWeightTrendAlert(userId, message) {
  return emitFitnessNotification({
    userId,
    type: 'fitness.weight_trend',
    payload: { message },
    link: '/dashboard',
  });
}

async function emitAiInsight(userId, insight) {
  const dateKey = new Date().toISOString().slice(0, 10);
  return emitFitnessNotification({
    userId,
    type: 'fitness.ai_insight',
    payload: { insight, dateKey },
    dedupeKey: `${userId}:fitness.ai_insight:${dateKey}`,
    link: '/ai',
  });
}

async function emitHeartRateAnomaly(userId, message) {
  return emitFitnessNotification({
    userId,
    type: 'fitness.heart_rate_anomaly',
    payload: { message },
    priority: 'HIGH',
  });
}

async function emitDailyDigest(userId, summary, dateKey) {
  return emitFitnessNotification({
    userId,
    type: 'fitness.daily_digest',
    payload: { summary, dateKey, userId },
    groupKey: `collapse:fitness.daily_digest:${userId}:${dateKey}`,
    dedupeKey: `${userId}:fitness.daily_digest:${dateKey}`,
    icon: 'wb_sunny',
  });
}

module.exports = {
  emitFitnessNotification,
  emitStreakMilestone,
  emitPersonalRecord,
  emitRecoveryChanged,
  emitHydrationGoal,
  emitWeeklySummary,
  emitMacroTarget,
  emitWeightTrendAlert,
  emitAiInsight,
  emitCoachFeedback,
  emitCoachFeedbackAvailable,
  emitHeartRateAnomaly,
  emitDailyDigest,
};
