/**
 * Race-safe grouped notification updates — atomic actor_count / collapsed_count increments.
 */
const { prisma } = require('../../db');
const { GROUP_WINDOW_DAYS, COLLAPSIBLE_TYPES } = require('./notificationConstants');
const { inc } = require('./notificationMetrics');

const MAX_GROUP_RETRIES = 8;

function windowStartDate() {
  const d = new Date();
  d.setDate(d.getDate() - GROUP_WINDOW_DAYS);
  return d;
}

/**
 * Atomically increment counters on an active grouped row.
 * @returns {Promise<object|null>} Updated row or null if no matching active group.
 */
async function atomicIncrementGroupedRow({ userId, groupKey, incrementActor, incrementCollapse }) {
  const actorDelta = incrementActor ? 1 : 0;
  const collapseDelta = incrementCollapse ? 1 : 0;
  const windowStart = windowStartDate();

  const rows = await prisma.$queryRaw`
    UPDATE notifications
    SET
      actor_count = actor_count + ${actorDelta},
      collapsed_count = collapsed_count + ${collapseDelta},
      updated_at = NOW(),
      read = false,
      read_at = NULL
    WHERE user_id = ${userId}
      AND group_key = ${groupKey}
      AND deleted_at IS NULL
      AND archived_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
      AND created_at >= ${windowStart}
    RETURNING *
  `;

  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}

/**
 * Optimistic merge of actorIds (best-effort — actor_count is authoritative).
 */
async function mergeActorFields(notificationId, actors, actorId, actorDisplayName, actorAvatarUrl, link) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: {
      actorIds: actors.length ? actors : undefined,
      actorId: actors[0]?.id || actorId || undefined,
      actorDisplayName: actors[0]?.displayName || actorDisplayName || undefined,
      actorAvatarUrl: actors[0]?.avatarUrl || actorAvatarUrl || undefined,
      link: link || undefined,
    },
  });
}

/**
 * Upsert grouped notification with retry on create races.
 * @returns {Promise<{ row: object, isNew: boolean }|null>}
 */
async function upsertWithGroupLock({ userId, groupKey, type, incrementActor, incrementCollapse, createFn, mergeFn }) {
  if (!groupKey) {
    const row = await createFn();
    return row ? { row, isNew: true } : null;
  }

  for (let attempt = 0; attempt < MAX_GROUP_RETRIES; attempt += 1) {
    const bumped = await atomicIncrementGroupedRow({
      userId,
      groupKey,
      incrementActor,
      incrementCollapse: incrementCollapse ?? COLLAPSIBLE_TYPES.has(type),
    });

    if (bumped) {
      inc('grouped');
      const merged = await mergeFn(bumped);
      return { row: merged, isNew: false };
    }

    try {
      const created = await createFn();
      if (created) {
        inc('created');
        return { row: created, isNew: true };
      }
    } catch (err) {
      if (err?.code === 'P2002') {
        inc('groupRaceRetries');
        continue;
      }
      throw err;
    }

    inc('groupRaceRetries');
  }

  const fallback = await prisma.notification.findFirst({
    where: { userId, groupKey, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
  });
  return fallback ? { row: fallback, isNew: false } : null;
}

module.exports = {
  atomicIncrementGroupedRow,
  mergeActorFields,
  upsertWithGroupLock,
  MAX_GROUP_RETRIES,
};
