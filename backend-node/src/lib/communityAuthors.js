const { attachPresenceFields } = require('./presence');

function authorHandle(email) {
  const local = (email || 'user').split('@')[0];
  return `@${local.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

/**
 * Map user to community author shape. Presence is included only when allowed for viewerId.
 * @param {object|null} user
 * @param {{ viewerId?: string, presenceAllowed?: boolean }} [opts]
 */
function mapAuthorIdentity(user, opts = {}) {
  if (!user) return user;
  const { viewerId, presenceAllowed } = opts;
  const base = { ...user, handle: authorHandle(user.email) };
  const isSelf = Boolean(viewerId && user.id === viewerId);
  if (isSelf || presenceAllowed === true) {
    return attachPresenceFields(base);
  }
  const { lastSeenAt: _ls, ...rest } = base;
  return { ...rest, isOnline: undefined, lastSeenAt: undefined };
}

module.exports = { authorHandle, mapAuthorIdentity };
