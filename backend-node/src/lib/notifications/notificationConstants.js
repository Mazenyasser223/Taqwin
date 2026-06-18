/** Notification domain constants — categories, priorities, expiry, grouping. */

const CATEGORIES = {
  SOCIAL: 'SOCIAL',
  WORKOUT: 'WORKOUT',
  AI: 'AI',
  SHOP: 'SHOP',
  SUPPORT: 'SUPPORT',
  GYM: 'GYM',
  SYSTEM: 'SYSTEM',
};

const PRIORITIES = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
};

/** type prefix → category */
const TYPE_CATEGORY = [
  { prefix: 'community.', cat: CATEGORIES.SOCIAL },
  { prefix: 'gamification.', cat: CATEGORIES.SOCIAL },
  { prefix: 'workout.', cat: CATEGORIES.WORKOUT },
  { prefix: 'plan.', cat: CATEGORIES.WORKOUT },
  { prefix: 'fitness.', cat: CATEGORIES.WORKOUT },
  { prefix: 'coach.', cat: CATEGORIES.AI },
  { prefix: 'booking.', cat: CATEGORIES.WORKOUT },
  { prefix: 'ai.', cat: CATEGORIES.AI },
  { prefix: 'order.', cat: CATEGORIES.SHOP },
  { prefix: 'promo.', cat: CATEGORIES.SHOP },
  { prefix: 'support.', cat: CATEGORIES.SUPPORT },
  { prefix: 'gym.', cat: CATEGORIES.GYM },
  { prefix: 'auth.', cat: CATEGORIES.SYSTEM },
];

/** type prefix → priority */
const TYPE_PRIORITY = [
  { prefix: 'support.', pri: PRIORITIES.URGENT },
  { prefix: 'auth.', pri: PRIORITIES.HIGH },
  { prefix: 'gamification.duel.', pri: PRIORITIES.HIGH },
  { prefix: 'community.follow_request', pri: PRIORITIES.HIGH },
  { prefix: 'community.group_invite', pri: PRIORITIES.HIGH },
  { prefix: 'community.group_join_request', pri: PRIORITIES.HIGH },
  { prefix: 'community.message', pri: PRIORITIES.HIGH },
  { prefix: 'community.message_request', pri: PRIORITIES.HIGH },
  { prefix: 'order.awaiting_payment', pri: PRIORITIES.HIGH },
  { prefix: 'coach.feedback_available', pri: PRIORITIES.HIGH },
  { prefix: 'fitness.pr_achieved', pri: PRIORITIES.HIGH },
  { prefix: 'fitness.streak_milestone', pri: PRIORITIES.HIGH },
  { prefix: 'promo.', pri: PRIORITIES.LOW },
  { prefix: 'order.reorder_reminder', pri: PRIORITIES.LOW },
  { prefix: 'community.ring', pri: PRIORITIES.LOW },
  { prefix: 'fitness.hydration_goal', pri: PRIORITIES.LOW },
];

/** type → expiry in days (null = never) */
const TYPE_EXPIRY_DAYS = {
  'community.story_mention': 7,
  'community.story_reaction': 7,
  'community.story_reply': 7,
  'community.story_reshare': 7,
  'community.ring': 7,
  'workout.reminder': 2,
  'plan.meal_reminder': 2,
  'fitness.daily_digest': 3,
  'fitness.recovery_changed': 3,
  'fitness.hydration_goal': 1,
  'fitness.weekly_summary': 14,
  'fitness.streak_milestone': 30,
  'fitness.pr_achieved': 90,
  'fitness.macro_target': 7,
  'fitness.weight_trend': 14,
  'fitness.ai_insight': 3,
  'fitness.coach_feedback': 7,
  'coach.feedback_available': 7,
  'fitness.heart_rate_anomaly': 7,
};

/** Types that aggregate into one notification per entity */
const GROUPABLE_TYPES = new Set([
  'community.reaction',
  'community.like',
  'community.comment',
  'community.comment_reply',
  'community.comment_reaction',
]);

/** Types that collapse by type+day */
const COLLAPSIBLE_TYPES = new Set(['workout.reminder', 'plan.meal_reminder']);

const GROUP_WINDOW_DAYS = 7;
const ARCHIVE_AFTER_DAYS = 90;
const SCHEMA_VERSION = 1;

/** type → material icon name */
const TYPE_ICONS = {
  'community.reaction': 'favorite',
  'community.comment': 'comment',
  'community.comment_reply': 'comment',
  'community.follow': 'person_add',
  'community.follow_request': 'person_add',
  'community.message': 'chat_bubble',
  'community.group_invite': 'group',
  'gamification.challenge.completed': 'emoji_events',
  'gamification.duel.invited': 'sports_martial_arts',
  'workout.reminder': 'fitness_center',
  'plan.meal_reminder': 'restaurant',
  'order.placed': 'shopping_bag',
  'order.shipped': 'local_shipping',
  'support.received': 'support_agent',
  'support.reply': 'support_agent',
  'fitness.streak_milestone': 'local_fire_department',
  'fitness.pr_achieved': 'military_tech',
  'fitness.daily_digest': 'wb_sunny',
  'fitness.recovery_changed': 'bedtime',
  'fitness.hydration_goal': 'water_drop',
  'fitness.weekly_summary': 'trending_up',
  'fitness.macro_target': 'restaurant',
  'fitness.weight_trend': 'monitor_weight',
  'fitness.ai_insight': 'psychology',
  'fitness.coach_feedback': 'groups',
  'coach.feedback_available': 'groups',
  'fitness.heart_rate_anomaly': 'favorite',
};

function categoryForType(type) {
  if (!type) return CATEGORIES.SYSTEM;
  for (const row of TYPE_CATEGORY) {
    if (type.startsWith(row.prefix) || type === row.prefix.slice(0, -1)) return row.cat;
  }
  return CATEGORIES.SYSTEM;
}

function priorityForType(type) {
  if (!type) return PRIORITIES.NORMAL;
  for (const row of TYPE_PRIORITY) {
    if (type.startsWith(row.prefix) || type === row.prefix) return row.pri;
  }
  return PRIORITIES.NORMAL;
}

function iconForType(type) {
  if (!type) return 'notifications';
  if (TYPE_ICONS[type]) return TYPE_ICONS[type];
  for (const [key, icon] of Object.entries(TYPE_ICONS)) {
    if (type.startsWith(key.split('.').slice(0, -1).join('.'))) return icon;
  }
  if (type.startsWith('community.')) return 'groups';
  if (type.startsWith('gamification.')) return 'emoji_events';
  if (type.startsWith('order.') || type.startsWith('promo.')) return 'shopping_bag';
  if (type.startsWith('gym.')) return 'fitness_center';
  if (type.startsWith('ai.') || type.startsWith('plan.')) return 'psychology';
  if (type.startsWith('workout.') || type.startsWith('fitness.')) return 'fitness_center';
  if (type.startsWith('support.')) return 'support_agent';
  return 'notifications';
}

function expiryDateForType(type, from = new Date()) {
  const days = TYPE_EXPIRY_DAYS[type];
  if (days == null) return null;
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

function buildGroupKey(type, payload = {}) {
  if (GROUPABLE_TYPES.has(type) && payload.postId) {
    return `group:${type}:post:${payload.postId}`;
  }
  if (type === 'community.comment' || type === 'community.comment_reply') {
    if (payload.postId) return `group:community.comment:post:${payload.postId}`;
  }
  if (COLLAPSIBLE_TYPES.has(type) && payload.dateKey) {
    return `collapse:${type}:${payload.userId || ''}:${payload.dateKey}`;
  }
  return null;
}

function buildDedupeKey(userId, type, payload = {}) {
  if (payload.dedupeKey) return payload.dedupeKey;
  if (payload.entityId && payload.dateKey) {
    return `${userId}:${type}:${payload.entityId}:${payload.dateKey}`;
  }
  if (payload.slotId && payload.dateKey) {
    return `${userId}:${type}:${payload.slotId}:${payload.dateKey}`;
  }
  if (COLLAPSIBLE_TYPES.has(type) && payload.dateKey && payload.link) {
    return `${userId}:${type}:${payload.link}:${payload.dateKey}`;
  }
  return null;
}

module.exports = {
  CATEGORIES,
  PRIORITIES,
  GROUPABLE_TYPES,
  COLLAPSIBLE_TYPES,
  GROUP_WINDOW_DAYS,
  ARCHIVE_AFTER_DAYS,
  SCHEMA_VERSION,
  categoryForType,
  priorityForType,
  iconForType,
  expiryDateForType,
  buildGroupKey,
  buildDedupeKey,
};
