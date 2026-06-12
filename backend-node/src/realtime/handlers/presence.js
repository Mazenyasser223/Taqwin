/**
 * WebSocket presence.ping — updates lastSeenAt and notifies watchers.
 */
const { prisma } = require('../../db');
const { publishToUsers } = require('../redisBus');
const { serverEnvelope } = require('../envelope');

async function handlePresencePing(ws, userId) {
  const now = new Date();
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: now },
    });
  } catch {
    /* non-fatal */
  }

  send(ws, serverEnvelope('presence.pong', { lastSeenAt: now.toISOString(), isOnline: true }));

  void publishPresenceUpdate(userId, now);
}

function send(ws, envelope) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(envelope));
}

async function publishPresenceUpdate(userId, lastSeenAt = new Date()) {
  const followers = await prisma.communityFollow.findMany({
    where: { followingId: userId },
    select: { followerId: true },
    take: 500,
  });
  const targetIds = followers.map((f) => f.followerId).filter(Boolean);
  if (!targetIds.length) return;

  await publishToUsers(targetIds, {
    type: 'presence.update',
    userId,
    lastSeenAt: lastSeenAt.toISOString(),
    isOnline: true,
    ts: Date.now(),
  });
}

module.exports = {
  handlePresencePing,
  publishPresenceUpdate,
};
