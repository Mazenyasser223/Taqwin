const { attachPresenceFields } = require('./presence');
const { attachProfile } = require('./profile');

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
  const { viewerId, presenceAllowed, leagueBadge } = opts;
  const base = { ...attachProfile(user), handle: authorHandle(user.email) };
  const isSelf = Boolean(viewerId && user.id === viewerId);
  let out;
  if (isSelf || presenceAllowed === true) {
    out = attachPresenceFields(base);
  } else {
    const { lastSeenAt: _ls, ...rest } = base;
    out = { ...rest, isOnline: undefined, lastSeenAt: undefined };
  }
  if (leagueBadge) {
    out = { ...out, league: leagueBadge };
  }
  return out;
}

module.exports = { authorHandle, mapAuthorIdentity };
