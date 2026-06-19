/**
 * Serialize notification rows for API + WebSocket responses.
 */
const { attachProfile, USER_PUBLIC_SELECT } = require('../profile');

function displayNameFromActor(actor) {
  const normalized = attachProfile(actor);
  if (!normalized) return null;
  const name = normalized.profile?.displayName?.trim() || normalized.profile?.businessName?.trim();
  if (name) return name;
  return (normalized.email || 'User').split('@')[0];
}

function serializeNotification(n, actorMap = null) {
  let row = n;
  if (n.actorId && actorMap && (!n.actorAvatarUrl || !n.actorDisplayName)) {
    const actor = actorMap.get(n.actorId);
    if (actor) {
      row = {
        ...n,
        actorDisplayName: n.actorDisplayName || displayNameFromActor(actor),
        actorAvatarUrl: n.actorAvatarUrl || actor.profile?.avatarUrl || null,
      };
    }
  }

  const read = Boolean(row.readAt || row.read);
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    message: row.message,
    link: row.link ?? null,
    category: row.category || 'SYSTEM',
    priority: row.priority || 'NORMAL',
    payload: row.payload ?? null,
    groupKey: row.groupKey ?? null,
    actorIds: row.actorIds ?? null,
    actorCount: row.actorCount ?? 1,
    actions: row.actions ?? null,
    icon: row.icon ?? null,
    imageUrl: row.imageUrl ?? null,
    schemaVersion: row.schemaVersion ?? 1,
    collapsedCount: row.collapsedCount ?? 1,
    read,
    readAt: row.readAt ?? null,
    seenAt: row.seenAt ?? null,
    expiresAt: row.expiresAt ?? null,
    snoozedUntil: row.snoozedUntil ?? null,
    actorId: row.actorId ?? null,
    actorDisplayName: row.actorDisplayName ?? null,
    actorAvatarUrl: row.actorAvatarUrl ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? row.createdAt,
  };
}

async function enrichActors(prisma, notifications) {
  const actorIds = [
    ...new Set(
      notifications
        .filter((n) => n.actorId && (!n.actorAvatarUrl || !n.actorDisplayName))
        .map((n) => n.actorId),
    ),
  ];
  if (actorIds.length === 0) return new Map();
  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: USER_PUBLIC_SELECT,
  });
  return new Map(actors.map((a) => [a.id, attachProfile(a)]));
}

module.exports = { serializeNotification, enrichActors, displayNameFromActor };
