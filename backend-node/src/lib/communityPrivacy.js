/**
 * Audience-based visibility for community content.
 * Audiences: everyone | followers | following | mutual | nobody | only_me
 */
const { prisma } = require('../db');

const AUDIENCES = ['everyone', 'followers', 'following', 'mutual', 'nobody', 'only_me'];

async function getFollowRelation(followerId, followingId) {
  return prisma.communityFollow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
  });
}

async function isAcceptedFollow(followerId, followingId) {
  const rel = await getFollowRelation(followerId, followingId);
  return rel?.status === 'accepted';
}

async function isMutualFollow(userIdA, userIdB) {
  const [aToB, bToA] = await Promise.all([
    isAcceptedFollow(userIdA, userIdB),
    isAcceptedFollow(userIdB, userIdA),
  ]);
  return aToB && bToA;
}

/**
 * Can viewer see owner's content protected by audience setting?
 */
async function audienceAllows(viewerId, ownerId, audience) {
  if (!AUDIENCES.includes(audience)) audience = 'only_me';
  if (viewerId === ownerId) return true;
  if (audience === 'only_me' || audience === 'nobody') return false;
  if (audience === 'everyone') return true;

  const viewerFollowsOwner = await isAcceptedFollow(viewerId, ownerId);
  const ownerFollowsViewer = await isAcceptedFollow(ownerId, viewerId);

  if (audience === 'followers') return viewerFollowsOwner;
  if (audience === 'following') return ownerFollowsViewer;
  if (audience === 'mutual') return viewerFollowsOwner && ownerFollowsViewer;
  return false;
}

async function getOrCreatePrivacySettings(userId) {
  const existing = await prisma.communityPrivacySettings.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.communityPrivacySettings.create({
    data: { userId },
  });
}

async function canViewStory(viewerId, authorId, settings) {
  if (viewerId === authorId) return true;
  const hideIds = Array.isArray(settings.storyHideFromIds) ? settings.storyHideFromIds : [];
  if (hideIds.includes(viewerId)) return false;
  return audienceAllows(viewerId, authorId, settings.storyAudience);
}

async function canViewPost(viewerId, post) {
  if (viewerId === post.authorId) return true;
  return audienceAllows(viewerId, post.authorId, post.visibility || 'everyone');
}

async function canMentionUser(mentionerId, targetUserId) {
  if (mentionerId === targetUserId) return true;
  const settings = await getOrCreatePrivacySettings(targetUserId);
  return audienceAllows(mentionerId, targetUserId, settings.mentionsAudience);
}

async function canSharePost(viewerId, authorId) {
  if (viewerId === authorId) return true;
  const settings = await getOrCreatePrivacySettings(authorId);
  return audienceAllows(viewerId, authorId, settings.sharesAudience);
}

module.exports = {
  AUDIENCES,
  audienceAllows,
  isMutualFollow,
  isAcceptedFollow,
  getOrCreatePrivacySettings,
  canViewStory,
  canViewPost,
  canMentionUser,
  canSharePost,
};
