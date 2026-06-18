/**
 * Community notifications with named actor (avatar + display name).
 */
const { prisma } = require('../db');
const { emitNotification } = require('./notifications');
const { resolveProfile } = require('./profile');
const { FEED_AUTHOR_SELECT } = require('../services/community/constants');

function displayNameFromUser(user) {
  if (!user) return 'Someone';
  const name = resolveProfile(user)?.displayName?.trim();
  if (name) return name;
  const local = (user.email || 'user').split('@')[0];
  return local;
}

async function fetchActor(actorId) {
  if (!actorId) return null;
  return prisma.user.findUnique({
    where: { id: actorId },
    select: FEED_AUTHOR_SELECT,
  });
}

function parsePostIdFromLink(link) {
  if (!link) return null;
  const m = link.match(/\/community\/posts\/([^/?#]+)/);
  return m?.[1] || null;
}

/**
 * @param {object} opts
 * @param {string} opts.userId - recipient
 * @param {string} opts.actorId - who performed the action
 * @param {string} opts.type
 * @param {string} [opts.link]
 * @param {object} [opts.payload]
 */
async function notifyWithActor({ userId, actorId, type, link, payload = {} }) {
  if (!userId || userId === actorId) return null;
  const actor = await fetchActor(actorId);
  const name = displayNameFromUser(actor);
  const postId = payload.postId || parsePostIdFromLink(link);
  const mergedPayload = {
    ...payload,
    postId,
    actorName: name,
    groupId: payload.groupId || null,
    storyId: payload.storyId || null,
  };

  return emitNotification({
    userId,
    type,
    link: link || null,
    actorId: actor?.id || actorId || null,
    actorDisplayName: name,
    actorAvatarUrl: resolveProfile(actor)?.communityAvatarUrl || null,
    payload: mergedPayload,
  });
}

async function notifyRingsOnNewContent(authorId, link, contentKind = 'post') {
  const rings = await prisma.communityPostRing.findMany({
    where: { targetUserId: authorId },
    select: { subscriberId: true },
  });
  const author = await fetchActor(authorId);
  const name = displayNameFromUser(author);
  await Promise.all(
    rings.map((r) =>
      emitNotification({
        userId: r.subscriberId,
        type: 'community.ring',
        link,
        actorId: authorId,
        actorDisplayName: name,
        actorAvatarUrl: resolveProfile(author)?.communityAvatarUrl || resolveProfile(author)?.avatarUrl || null,
        payload: {
          actorName: name,
          contentKind,
          storyId: link?.match(/story=([^&]+)/)?.[1] || null,
        },
      }),
    ),
  );
}

module.exports = { notifyWithActor, notifyRingsOnNewContent, displayNameFromUser };
