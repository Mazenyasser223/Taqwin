/** Online presence — lastSeenAt on User, considered online within ONLINE_WINDOW_MS. */

const ONLINE_WINDOW_MS = 3 * 60 * 1000;

function isOnlineFromLastSeen(lastSeenAt) {
  if (!lastSeenAt) return false;
  const t = lastSeenAt instanceof Date ? lastSeenAt.getTime() : new Date(lastSeenAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < ONLINE_WINDOW_MS;
}

function serializeLastSeen(lastSeenAt) {
  if (!lastSeenAt) return null;
  const d = lastSeenAt instanceof Date ? lastSeenAt : new Date(lastSeenAt);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function attachPresenceFields(user) {
  if (!user) return user;
  const lastSeenAt = serializeLastSeen(user.lastSeenAt);
  const { lastSeenAt: _raw, ...rest } = user;
  return {
    ...rest,
    lastSeenAt,
    isOnline: isOnlineFromLastSeen(lastSeenAt),
  };
}

module.exports = {
  ONLINE_WINDOW_MS,
  isOnlineFromLastSeen,
  attachPresenceFields,
};
