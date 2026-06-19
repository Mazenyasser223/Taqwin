/**
 * Notification list query filters — shared by routes and tests.
 */
const { CATEGORIES, categoryForType } = require('./notificationConstants');

function activeNotificationWindow(now = new Date()) {
  return {
    AND: [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      { OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }] },
    ],
  };
}

function buildListWhere(userId, category, now = new Date()) {
  const base = {
    userId,
    deletedAt: null,
    archivedAt: null,
    ...activeNotificationWindow(now),
  };

  if (category === 'UNREAD') {
    base.readAt = null;
  } else if (category && category !== 'ALL' && CATEGORIES[category]) {
    base.category = category;
  }

  return base;
}

function buildUnreadWhere(userId, now = new Date()) {
  return buildListWhere(userId, 'UNREAD', now);
}

/** Rows whose stored category drifted from type mapping (legacy / test data). */
function categoryNeedsRepair(row) {
  if (!row?.type) return false;
  const expected = categoryForType(row.type);
  return row.category !== expected;
}

module.exports = {
  activeNotificationWindow,
  buildListWhere,
  buildUnreadWhere,
  categoryNeedsRepair,
  categoryForType,
};
