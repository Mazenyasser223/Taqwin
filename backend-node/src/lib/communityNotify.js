/**
 * Community notifications with named actor (avatar + display name).
 */
const { prisma } = require('../db');
const { emitNotification } = require('./notifications');

const AUTHOR_SELECT = {
  id: true,
  email: true,
  profile: { select: { displayName: true, avatarUrl: true } },
};

function displayNameFromUser(user) {
  if (!user) return 'Someone';
  const name = user.profile?.displayName?.trim();
  if (name) return name;
  const local = (user.email || 'user').split('@')[0];
  return local;
}

async function fetchActor(actorId) {
  if (!actorId) return null;
  return prisma.user.findUnique({
    where: { id: actorId },
    select: AUTHOR_SELECT,
  });
}

/**
 * @param {object} opts
 * @param {string} opts.userId - recipient
 * @param {string} opts.actorId - who performed the action
 * @param {string} opts.type
 * @param {string} opts.title - short action label (e.g. "liked your post")
 * @param {string} [opts.message] - optional extra detail; defaults to title with actor name
 * @param {string} [opts.link]
 */
async function notifyWithActor({ userId, actorId, type, title, message, link }) {
  if (!userId || userId === actorId) return null;
  const actor = await fetchActor(actorId);
  const name = displayNameFromUser(actor);
  const body = message || `${name} ${title}`;
  return emitNotification({
    userId,
    type,
    title: name,
    message: body,
    link: link || null,
    actorId: actor?.id || actorId || null,
    actorDisplayName: name,
    actorAvatarUrl: actor?.profile?.avatarUrl || null,
  });
}

async function notifyRingsOnNewContent(authorId, link, contentLabel) {
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
        title: name,
        message: `${name} added a new ${contentLabel}`,
        link,
        actorId: authorId,
        actorDisplayName: name,
        actorAvatarUrl: author?.profile?.avatarUrl || null,
      }),
    ),
  );
}

module.exports = { notifyWithActor, notifyRingsOnNewContent, displayNameFromUser };
