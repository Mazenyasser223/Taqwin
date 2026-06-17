/**
 * WebSocket fan-out for community feed, comments, stories, and interaction counts.
 */
const { prisma } = require('../../db');
const {
  pushRealtime,
  communityPostEnvelope,
  communityCommentEnvelope,
  communityStoryEnvelope,
  communityPostUpdateEnvelope,
  communityProfileUpdateEnvelope,
  communityGroupUpdateEnvelope,
  communityGroupDeletedEnvelope,
  communityInboxReadEnvelope,
  communityInboxUpdatedEnvelope,
} = require('../../realtime/publish');
const { mapInboxMessage } = require('./inboxService');
const { REACTION_EMOJIS } = require('./constants');

async function getFollowerAndRingAudience(authorId, excludeUserId) {
  const [followers, rings] = await Promise.all([
    prisma.communityFollow.findMany({
      where: { followingId: authorId, status: 'accepted' },
      select: { followerId: true },
    }),
    prisma.communityPostRing.findMany({
      where: { targetUserId: authorId },
      select: { subscriberId: true },
    }),
  ]);
  const ids = new Set();
  for (const f of followers) ids.add(f.followerId);
  for (const r of rings) ids.add(r.subscriberId);
  if (excludeUserId) ids.delete(excludeUserId);
  return [...ids];
}

async function getGroupMemberIds(groupId, excludeUserId) {
  const members = await prisma.communityGroupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });
  return members.map((m) => m.userId).filter((id) => id !== excludeUserId);
}

async function getPostEngagedUserIds(postId, extraIds = []) {
  const [commenters, likers, reposters, post] = await Promise.all([
    prisma.communityComment.findMany({
      where: { postId },
      select: { authorId: true },
      distinct: ['authorId'],
    }),
    prisma.communityPostLike.findMany({
      where: { postId },
      select: { userId: true },
      take: 150,
    }),
    prisma.communityPostRepost.findMany({
      where: { postId },
      select: { userId: true },
      take: 150,
    }),
    prisma.communityPost.findUnique({
      where: { id: postId },
      select: { authorId: true },
    }),
  ]);
  const ids = new Set(extraIds);
  if (post?.authorId) ids.add(post.authorId);
  for (const c of commenters) ids.add(c.authorId);
  for (const l of likers) ids.add(l.userId);
  for (const r of reposters) ids.add(r.userId);
  return [...ids];
}

async function buildPostCountsBroadcast(postId) {
  const [post, reactionGroups] = await Promise.all([
    prisma.communityPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        likesCount: true,
        repostsCount: true,
        _count: { select: { comments: true } },
      },
    }),
    prisma.communityPostLike.groupBy({
      by: ['emoji'],
      where: { postId },
      _count: { _all: true },
    }),
  ]);
  if (!post) return null;

  const reactions = {};
  for (const emoji of REACTION_EMOJIS) reactions[emoji] = 0;
  let total = 0;
  for (const row of reactionGroups) {
    const emoji = REACTION_EMOJIS.includes(row.emoji) ? row.emoji : 'like';
    reactions[emoji] = row._count._all;
    total += row._count._all;
  }

  return {
    id: post.id,
    likesCount: total || post.likesCount,
    repostsCount: post.repostsCount,
    commentsCount: post._count.comments,
    reactions,
  };
}

async function resolvePostBroadcastAudience(postId, authorId, groupId) {
  const audience = new Set(await getFollowerAndRingAudience(authorId));
  if (groupId) {
    for (const id of await getGroupMemberIds(groupId)) audience.add(id);
  }
  for (const id of await getPostEngagedUserIds(postId)) audience.add(id);
  return [...audience];
}

/** Push a new post to followers, ring subscribers, group members, and mentions. */
function pushNewPostRealtime(enrichedPost, authorId, { groupId, mentionUserIds = [] } = {}) {
  void (async () => {
    try {
      const audience = new Set(await getFollowerAndRingAudience(authorId, authorId));
      for (const id of mentionUserIds) audience.add(id);
      if (groupId) {
        for (const id of await getGroupMemberIds(groupId, authorId)) audience.add(id);
      }
      audience.add(authorId);
      if (!audience.size) return;
      await pushRealtime([...audience], communityPostEnvelope(enrichedPost));
    } catch {
      /* optional — polling still syncs */
    }
  })();
}

/** Push a new comment to post author, parent author, and others engaged on the post. */
function pushNewCommentRealtime(postId, comment, notifyUserIds = []) {
  void (async () => {
    try {
      const audience = await getPostEngagedUserIds(postId, notifyUserIds);
      if (!audience.length) return;
      await pushRealtime(audience, communityCommentEnvelope(postId, comment));
    } catch {
      /* optional */
    }
  })();
}

/** Push updated like/comment/repost counts to feed viewers. */
function pushPostCountsRealtime(postId) {
  void (async () => {
    try {
      const post = await prisma.communityPost.findUnique({
        where: { id: postId },
        select: { authorId: true, groupId: true },
      });
      if (!post) return;
      const patch = await buildPostCountsBroadcast(postId);
      if (!patch) return;
      const audience = await resolvePostBroadcastAudience(postId, post.authorId, post.groupId);
      if (!audience.length) return;
      await pushRealtime(audience, communityPostUpdateEnvelope(postId, patch));
    } catch {
      /* optional */
    }
  })();
}

/** Push a new story to followers and ring subscribers. */
function pushNewStoryRealtime(story, authorId, mentionUserIds = []) {
  void (async () => {
    try {
      const audience = new Set(await getFollowerAndRingAudience(authorId, authorId));
      for (const id of mentionUserIds) audience.add(id);
      if (!audience.size) return;
      await pushRealtime([...audience], communityStoryEnvelope(story));
    } catch {
      /* optional */
    }
  })();
}

/** Push profile shell changes (follow counts, follow status) to viewers. */
function pushProfileShellRealtime(profileUserId, userIds, patch) {
  void (async () => {
    try {
      const ids = [...new Set((userIds || []).filter((id) => typeof id === 'string' && id))];
      if (!ids.length || !profileUserId || !patch || typeof patch !== 'object') return;
      await pushRealtime(ids, communityProfileUpdateEnvelope(profileUserId, patch));
    } catch {
      /* optional */
    }
  })();
}

/** After follow / unfollow — update both profiles in real time. */
function pushFollowProfileRealtime(viewerId, targetUserId, payload) {
  const { targetCounts, viewerCounts, followStatus, following } = payload;
  pushProfileShellRealtime(targetUserId, [viewerId, targetUserId], {
    followersCount: targetCounts?.followersCount,
    followStatus,
    isFollowing: following,
  });
  if (viewerCounts && viewerId) {
    pushProfileShellRealtime(viewerId, [viewerId], {
      followingCount: viewerCounts.followingCount,
    });
  }
}

async function getGroupActiveMemberIds(groupId) {
  const group = await prisma.communityGroup.findUnique({
    where: { id: groupId },
    select: { ownerId: true },
  });
  if (!group) return [];
  const rows = await prisma.communityGroupMember.findMany({
    where: { groupId, status: 'accepted' },
    select: { userId: true },
  });
  const ids = new Set(rows.map((r) => r.userId));
  ids.add(group.ownerId);
  return [...ids];
}

/** Push group shell patch (counts, name) to active members. */
function pushGroupPatchRealtime(groupId, userIds, patch) {
  void (async () => {
    try {
      const ids = [...new Set((userIds || []).filter(Boolean))];
      if (!ids.length || !groupId || !patch) return;
      await pushRealtime(ids, communityGroupUpdateEnvelope(groupId, { patch }));
    } catch {
      /* optional */
    }
  })();
}

/** Push viewer-specific group row (join/leave/settings) to one or more users. */
function pushGroupRowRealtime(userIds, group) {
  void (async () => {
    try {
      const ids = [...new Set((userIds || []).filter(Boolean))];
      if (!ids.length || !group?.id) return;
      await pushRealtime(ids, communityGroupUpdateEnvelope(group.id, { group }));
    } catch {
      /* optional */
    }
  })();
}

/** Notify members that a group was deleted. */
function pushGroupDeletedRealtime(groupId, userIds) {
  void (async () => {
    try {
      const ids = [...new Set((userIds || []).filter(Boolean))];
      if (!ids.length || !groupId) return;
      await pushRealtime(ids, communityGroupDeletedEnvelope(groupId));
    } catch {
      /* optional */
    }
  })();
}

/** After membership or metadata change — patch members + full row for actor. */
async function pushGroupChangeRealtime(groupId, { actorUserId, actorGroup, patch } = {}) {
  try {
    const memberIds = await getGroupActiveMemberIds(groupId);
    if (patch && memberIds.length) {
      pushGroupPatchRealtime(groupId, memberIds, patch);
    }
    if (actorGroup && actorUserId) {
      pushGroupRowRealtime([actorUserId], actorGroup);
    }
  } catch {
    /* optional */
  }
}

/** Push a new DM/group message to all conversation participants (multi-device sync). */
function pushNewInboxMessageRealtime(conversationId, messageRow, participantUserIds) {
  void (async () => {
    try {
      const ids = [...new Set((participantUserIds || []).filter(Boolean))];
      if (!ids.length || !conversationId || !messageRow?.id) return;
      await Promise.all(
        ids.map(async (userId) => {
          const mapped = mapInboxMessage(messageRow, userId, null, new Map());
          await pushRealtime([userId], communityMessageEnvelope(conversationId, mapped));
        }),
      );
    } catch {
      /* optional */
    }
  })();
}

/** Notify the other party that messages were read (read receipts). */
function pushInboxReadRealtime(conversationId, readerUserId, recipientUserIds, readAt) {
  void (async () => {
    try {
      const ids = [...new Set((recipientUserIds || []).filter((id) => id && id !== readerUserId))];
      if (!ids.length || !conversationId) return;
      await pushRealtime(
        ids,
        communityInboxReadEnvelope(conversationId, {
          readerUserId,
          readAt: readAt instanceof Date ? readAt.toISOString() : readAt,
        }),
      );
    } catch {
      /* optional */
    }
  })();
}

/** Push updated conversation shell (accept request, star, group settings). */
function pushInboxConversationRealtime(userIds, conversation) {
  void (async () => {
    try {
      const ids = [...new Set((userIds || []).filter(Boolean))];
      if (!ids.length || !conversation?.id) return;
      await pushRealtime(ids, communityInboxUpdatedEnvelope(conversation.id, conversation));
    } catch {
      /* optional */
    }
  })();
}

module.exports = {
  pushNewPostRealtime,
  pushNewCommentRealtime,
  pushPostCountsRealtime,
  pushNewStoryRealtime,
  pushProfileShellRealtime,
  pushFollowProfileRealtime,
  buildPostCountsBroadcast,
  getGroupActiveMemberIds,
  pushGroupPatchRealtime,
  pushGroupRowRealtime,
  pushGroupDeletedRealtime,
  pushGroupChangeRealtime,
  pushNewInboxMessageRealtime,
  pushInboxReadRealtime,
  pushInboxConversationRealtime,
};
