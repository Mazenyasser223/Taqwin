const { prisma } = require('../../db');
const { POST_INCLUDE } = require('./constants');
const { enrichPosts } = require('./postsService');

const MAX_PROFILE_PINS = 3;
const MAX_GROUP_FEATURED = 5;

function sortPostsWithPins(posts, { profile = false, group = false } = {}) {
  if (!profile && !group) return posts;
  const pinKey = profile ? 'profilePinnedAt' : 'groupPinnedAt';
  return [...posts].sort((a, b) => {
    const aPin = a[pinKey] ? new Date(a[pinKey]).getTime() : 0;
    const bPin = b[pinKey] ? new Date(b[pinKey]).getTime() : 0;
    if (aPin && bPin) return bPin - aPin;
    if (aPin && !bPin) return -1;
    if (!aPin && bPin) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

async function pinProfilePost(postId, userId) {
  const post = await prisma.communityPost.findUnique({ where: { id: postId } });
  if (!post || post.authorId !== userId) return { notFound: true };
  if (post.groupId) return { forbidden: true };
  const count = await prisma.communityPost.count({
    where: { authorId: userId, groupId: null, profilePinnedAt: { not: null } },
  });
  if (!post.profilePinnedAt && count >= MAX_PROFILE_PINS) {
    return { limit: true, max: MAX_PROFILE_PINS };
  }
  await prisma.communityPost.update({
    where: { id: postId },
    data: { profilePinnedAt: new Date() },
  });
  return { ok: true };
}

async function unpinProfilePost(postId, userId) {
  const post = await prisma.communityPost.findUnique({ where: { id: postId } });
  if (!post || post.authorId !== userId) return { notFound: true };
  await prisma.communityPost.update({
    where: { id: postId },
    data: { profilePinnedAt: null },
  });
  return { ok: true };
}

async function isGroupAdmin(groupId, userId) {
  const membership = await prisma.communityGroupMember.findFirst({
    where: { groupId, userId, status: 'accepted' },
  });
  return membership && ['owner', 'admin'].includes(membership.role);
}

async function pinGroupPost(postId, userId) {
  const post = await prisma.communityPost.findUnique({ where: { id: postId } });
  if (!post?.groupId) return { notFound: true };
  if (!(await isGroupAdmin(post.groupId, userId))) return { forbidden: true };
  const count = await prisma.communityPost.count({
    where: { groupId: post.groupId, groupPinnedAt: { not: null } },
  });
  if (!post.groupPinnedAt && count >= MAX_GROUP_FEATURED) {
    return { limit: true, max: MAX_GROUP_FEATURED };
  }
  await prisma.communityPost.update({
    where: { id: postId },
    data: { groupPinnedAt: new Date() },
  });
  return { ok: true };
}

async function unpinGroupPost(postId, userId) {
  const post = await prisma.communityPost.findUnique({ where: { id: postId } });
  if (!post?.groupId) return { notFound: true };
  if (!(await isGroupAdmin(post.groupId, userId))) return { forbidden: true };
  await prisma.communityPost.update({
    where: { id: postId },
    data: { groupPinnedAt: null },
  });
  return { ok: true };
}

async function getGroupFeaturedPosts(viewerId, groupId) {
  const group = await prisma.communityGroup.findUnique({ where: { id: groupId } });
  if (!group) return { notFound: true };
  const membership = await prisma.communityGroupMember.findFirst({
    where: { groupId, userId: viewerId, status: 'accepted' },
  });
  if (!membership && group.privacy !== 'public') return { forbidden: true };
  const posts = await prisma.communityPost.findMany({
    where: { groupId, groupPinnedAt: { not: null } },
    include: POST_INCLUDE,
    orderBy: { groupPinnedAt: 'desc' },
    take: MAX_GROUP_FEATURED,
  });
  const data = await enrichPosts(posts, viewerId);
  return { data };
}

module.exports = {
  MAX_PROFILE_PINS,
  MAX_GROUP_FEATURED,
  sortPostsWithPins,
  pinProfilePost,
  unpinProfilePost,
  pinGroupPost,
  unpinGroupPost,
  getGroupFeaturedPosts,
};
