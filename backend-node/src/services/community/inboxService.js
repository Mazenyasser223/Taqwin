const { prisma } = require('../../db');
const { redisGetJson, redisSetJson } = require('../../lib/redis');
const { mapAuthorIdentity } = require('../../lib/communityAuthors');
const { buildPresenceAccessMap } = require('../../lib/communityPrivacy');
const { normalizeMediaUrl } = require('../../lib/normalizeMediaUrl');
const { FEED_AUTHOR_SELECT } = require('./constants');
const { getInboxCacheGeneration } = require('./cacheGeneration');

const INBOX_LIST_TTL_MS = 12_000;
const INBOX_MESSAGES_TTL_MS = 10_000;
const USER_SELECT = FEED_AUTHOR_SELECT;

async function getMessageStarMeta(viewerId, messageIds) {
  const map = new Map();
  if (!viewerId || !messageIds.length) return map;
  const rows = await prisma.communityMessageStar.findMany({
    where: { userId: viewerId, messageId: { in: messageIds } },
    select: { messageId: true, starredAt: true },
  });
  for (const row of rows) map.set(row.messageId, row.starredAt);
  return map;
}

function mapInboxMessage(m, viewerId, otherLastReadAt, starMeta) {
  const starredAt = starMeta?.get(m.id);
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    messageType: m.messageType || 'text',
    content: m.content,
    mediaUrl: normalizeMediaUrl(m.mediaUrl),
    createdAt: m.createdAt,
    deliveredAt: m.deliveredAt,
    sender: mapAuthorIdentity(m.sender),
    isMine: m.senderId === viewerId,
    status: inboxMessageStatus(m, viewerId, otherLastReadAt),
    isStarred: Boolean(starredAt),
    starredAt: starredAt ?? null,
  };
}

async function mapInboxMessages(messages, viewerId, otherLastReadAt) {
  const starMeta = await getMessageStarMeta(
    viewerId,
    messages.map((m) => m.id),
  );
  return messages.map((m) => mapInboxMessage(m, viewerId, otherLastReadAt, starMeta));
}

function inboxMessageStatus(message, viewerId, otherLastReadAt) {
  if (message.senderId !== viewerId) return undefined;
  if (otherLastReadAt && new Date(message.createdAt) <= new Date(otherLastReadAt)) return 'read';
  if (message.deliveredAt) return 'delivered';
  return 'sent';
}

async function batchUnreadCounts(viewerId, convRows) {
  const counts = new Map(convRows.map((c) => [c.id, 0]));
  const needCount = convRows.filter(({ lastMsg, lastRead }) => {
    if (!lastMsg || lastMsg.senderId === viewerId) return false;
    return !lastRead || new Date(lastMsg.createdAt) > new Date(lastRead);
  });
  if (!needCount.length) return counts;

  await Promise.all(
    needCount.map(async ({ id, lastRead }) => {
      const c = await prisma.communityMessage.count({
        where: {
          conversationId: id,
          senderId: { not: viewerId },
          ...(lastRead ? { createdAt: { gt: lastRead } } : {}),
        },
      });
      counts.set(id, c);
    }),
  );
  return counts;
}

function formatConversationRow(conv, viewerId, unreadCounts, presenceMap, { includeParticipants = false } = {}) {
  const otherParticipants = conv.participants.filter((p) => p.userId !== viewerId);
  const other = otherParticipants[0]?.user;
  const lastMsg = conv.messages[0];
  const unreadCount = unreadCounts.get(conv.id) ?? 0;
  const myParticipant = conv.participants.find((p) => p.userId === viewerId);

  const isGroup = conv.isGroup === true;
  const isMessageRequest = !isGroup && conv.status === 'pending' && conv.initiatedById !== viewerId;
  const canSendMessage = isGroup || conv.status === 'active' || conv.initiatedById === viewerId;
  const presenceAllowed = other ? presenceMap.get(other.id) === true : false;

  const participantsList =
    includeParticipants && isGroup
      ? conv.participants
          .map((p) => {
            if (!p.user) return null;
            const pa = presenceMap.get(p.userId) === true;
            return { ...mapAuthorIdentity(p.user, { viewerId, presenceAllowed: pa }), role: p.role ?? 'member' };
          })
          .filter(Boolean)
      : null;

  const myRole = myParticipant?.role ?? 'member';
  const participantsCount = isGroup ? conv.participants.length : undefined;
  const isStarred = Boolean(myParticipant?.starredAt);

  return {
    id: conv.id,
    updatedAt: conv.updatedAt,
    status: conv.status,
    isGroup,
    name: conv.name ?? null,
    avatarUrl: conv.avatarUrl ? normalizeMediaUrl(conv.avatarUrl) : null,
    bio: conv.bio ?? null,
    canAddMembers: conv.canAddMembers ?? 'admins',
    canSendMessages: conv.canSendMessages ?? 'all',
    myRole,
    isStarred,
    starredAt: myParticipant?.starredAt ?? null,
    isMessageRequest,
    canSendMessage,
    otherUser: !isGroup && other ? mapAuthorIdentity(other, { viewerId, presenceAllowed }) : null,
    participants: participantsList,
    participantsCount,
    lastMessage: lastMsg
      ? {
          content: lastMsg.content,
          createdAt: lastMsg.createdAt,
          senderId: lastMsg.senderId,
          isMine: lastMsg.senderId === viewerId,
        }
      : null,
    unreadCount,
  };
}

async function hydrateConversations(conversations, viewerId, opts = {}) {
  if (!conversations.length) return [];

  const participantUserIds = [...new Set(conversations.flatMap((c) => c.participants.map((p) => p.userId)))];
  const participantUsers = participantUserIds.length
    ? await prisma.user.findMany({ where: { id: { in: participantUserIds } }, select: USER_SELECT })
    : [];
  const userById = new Map(participantUsers.map((u) => [u.id, u]));

  for (const conv of conversations) {
    conv.participants = conv.participants
      .map((p) => ({ ...p, user: userById.get(p.userId) ?? null }))
      .filter((p) => p.user);
  }

  const presenceMap = await buildPresenceAccessMap(viewerId, participantUserIds);
  const convRows = conversations.map((conv) => {
    const myParticipant = conv.participants.find((p) => p.userId === viewerId);
    return {
      id: conv.id,
      lastMsg: conv.messages[0] ?? null,
      lastRead: myParticipant?.lastReadAt ?? null,
    };
  });
  const unreadCounts = await batchUnreadCounts(viewerId, convRows);

  return conversations.map((c) => formatConversationRow(c, viewerId, unreadCounts, presenceMap, opts));
}

/** One inbox row per person for 1:1 chats (merges duplicate DB threads). */
function dedupeDirectConversations(conversations) {
  const groups = [];
  const dmByOther = new Map();

  for (const c of conversations) {
    if (c.isGroup) {
      groups.push(c);
      continue;
    }
    const otherId = c.otherUser?.id;
    if (!otherId) continue;

    const existing = dmByOther.get(otherId);
    if (!existing) {
      dmByOther.set(otherId, c);
      continue;
    }

    const aHas = existing.lastMessage ? 1 : 0;
    const bHas = c.lastMessage ? 1 : 0;
    let keep = existing;
    let drop = c;
    if (bHas > aHas || (bHas === aHas && new Date(c.updatedAt) > new Date(existing.updatedAt))) {
      keep = c;
      drop = existing;
    }
    dmByOther.set(otherId, {
      ...keep,
      unreadCount: keep.unreadCount ?? 0,
      isStarred: Boolean(keep.isStarred || drop.isStarred),
      starredAt: keep.starredAt || drop.starredAt || null,
    });
  }

  return sortInboxConversations([...dmByOther.values(), ...groups]);
}

function sortInboxConversations(conversations) {
  return [...conversations].sort((a, b) => {
    if (a.isStarred && !b.isStarred) return -1;
    if (!a.isStarred && b.isStarred) return 1;
    if (a.isStarred && b.isStarred) {
      const starDiff =
        new Date(b.starredAt || b.updatedAt).getTime() - new Date(a.starredAt || a.updatedAt).getTime();
      if (starDiff !== 0) return starDiff;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

async function setConversationStarred(conversationId, viewerId, starred) {
  const member = await prisma.communityConversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: viewerId } },
  });
  if (!member) return { notFound: true };

  await prisma.communityConversationParticipant.update({
    where: { id: member.id },
    data: { starredAt: starred ? new Date() : null },
  });

  const conv = await loadConversationForMember(conversationId, viewerId, { includeParticipants: false });
  return { data: conv };
}

async function listConversations(viewerId, folder) {
  const gen = await getInboxCacheGeneration();
  const cacheKey = `community:inbox:list:v4:${gen}:${viewerId}:${folder}`;
  const hit = await redisGetJson(cacheKey);
  if (hit) return hit;

  const memberships = await prisma.communityConversationParticipant.findMany({
    where: { userId: viewerId },
    select: { conversationId: true },
  });
  const ids = memberships.map((m) => m.conversationId);
  if (!ids.length) {
    await redisSetJson(cacheKey, [], INBOX_LIST_TTL_MS);
    return [];
  }

  const conversations = await prisma.communityConversation.findMany({
    where: { id: { in: ids } },
    include: {
      participants: true,
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const formatted = await hydrateConversations(conversations, viewerId);
  const filtered = formatted.filter((c) => (folder === 'requests' ? c.isMessageRequest : !c.isMessageRequest));
  const deduped = dedupeDirectConversations(filtered);
  await redisSetJson(cacheKey, deduped, INBOX_LIST_TTL_MS);
  return deduped;
}

async function loadConversationForMember(conversationId, viewerId, { includeParticipants = true } = {}) {
  const member = await prisma.communityConversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: viewerId } },
  });
  if (!member) return null;

  const conv = await prisma.communityConversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: true,
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!conv) return null;

  const [formatted] = await hydrateConversations([conv], viewerId, { includeParticipants });
  return formatted ?? null;
}

async function getConversationMessages(viewerId, conversationId, sinceValid) {
  if (sinceValid) {
    const member = await prisma.communityConversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: viewerId } },
      select: { id: true },
    });
    if (!member) return { forbidden: true };

    const otherParticipant = await prisma.communityConversationParticipant.findFirst({
      where: { conversationId, userId: { not: viewerId } },
      select: { lastReadAt: true },
    });
    const otherLastReadAt = otherParticipant?.lastReadAt ?? null;

    const now = new Date();
    try {
      await prisma.communityMessage.updateMany({
        where: {
          conversationId,
          senderId: { not: viewerId },
          deliveredAt: null,
          createdAt: { gt: sinceValid },
        },
        data: { deliveredAt: now },
      });
    } catch (deliverErr) {
      if (deliverErr?.code !== 'P2022') throw deliverErr;
    }

    const [newMessages, deliveredUpdates] = await Promise.all([
      prisma.communityMessage.findMany({
        where: { conversationId, createdAt: { gt: sinceValid } },
        include: { sender: { select: USER_SELECT } },
        orderBy: { createdAt: 'asc' },
        take: 50,
      }),
      prisma.communityMessage.findMany({
        where: {
          conversationId,
          senderId: viewerId,
          deliveredAt: { gt: sinceValid },
        },
        include: { sender: { select: USER_SELECT } },
        orderBy: { createdAt: 'asc' },
        take: 50,
      }),
    ]);

    const byId = new Map();
    for (const m of [...newMessages, ...deliveredUpdates]) byId.set(m.id, m);
    const merged = Array.from(byId.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    const mapped = await mapInboxMessages(merged, viewerId, otherLastReadAt);
    return {
      messages: mapped,
      otherLastReadAt: otherLastReadAt ? otherLastReadAt.toISOString() : null,
    };
  }

  if (!sinceValid) {
    const gen = await getInboxCacheGeneration();
    const cacheKey = `community:inbox:msgs:v3:${gen}:${viewerId}:${conversationId}`;
    const hit = await redisGetJson(cacheKey);
    if (hit) return hit;
  }

  const member = await prisma.communityConversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: viewerId } },
  });
  if (!member) return { forbidden: true };

  const otherParticipant = await prisma.communityConversationParticipant.findFirst({
    where: { conversationId, userId: { not: viewerId } },
  });
  const otherLastReadAt = otherParticipant?.lastReadAt ?? null;

  if (!sinceValid) {
    try {
      const now = new Date();
      await prisma.communityMessage.updateMany({
        where: {
          conversationId,
          senderId: { not: viewerId },
          deliveredAt: null,
        },
        data: { deliveredAt: now },
      });
    } catch (deliverErr) {
      if (deliverErr?.code !== 'P2022') throw deliverErr;
    }
  }

  const messages = await prisma.communityMessage.findMany({
    where: {
      conversationId,
      ...(sinceValid ? { createdAt: { gte: sinceValid } } : {}),
    },
    include: { sender: { select: USER_SELECT } },
    orderBy: { createdAt: 'asc' },
    take: sinceValid ? 100 : 200,
  });

  const payload = {
    messages: await mapInboxMessages(messages, viewerId, otherLastReadAt),
    otherLastReadAt: otherLastReadAt ? otherLastReadAt.toISOString() : null,
  };

  if (!sinceValid) {
    const gen = await getInboxCacheGeneration();
    const cacheKey = `community:inbox:msgs:v3:${gen}:${viewerId}:${conversationId}`;
    await redisSetJson(cacheKey, payload, INBOX_MESSAGES_TTL_MS);
  }

  return payload;
}

async function setMessageStarred(messageId, viewerId, starred) {
  const message = await prisma.communityMessage.findUnique({
    where: { id: messageId },
    include: { sender: { select: USER_SELECT } },
  });
  if (!message) return { notFound: true };

  const member = await prisma.communityConversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId: message.conversationId, userId: viewerId },
    },
  });
  if (!member) return { forbidden: true };
  if (message.messageType === 'system') return { forbidden: true };

  if (starred) {
    await prisma.communityMessageStar.upsert({
      where: { messageId_userId: { messageId, userId: viewerId } },
      update: { starredAt: new Date() },
      create: { messageId, userId: viewerId },
    });
  } else {
    await prisma.communityMessageStar.deleteMany({
      where: { messageId, userId: viewerId },
    });
  }

  const otherParticipant = await prisma.communityConversationParticipant.findFirst({
    where: { conversationId: message.conversationId, userId: { not: viewerId } },
    select: { lastReadAt: true },
  });
  const starMeta = await getMessageStarMeta(viewerId, [message.id]);
  return {
    data: mapInboxMessage(
      message,
      viewerId,
      otherParticipant?.lastReadAt ?? null,
      starMeta,
    ),
  };
}

async function listStarredMessages(viewerId) {
  const stars = await prisma.communityMessageStar.findMany({
    where: { userId: viewerId },
    orderBy: { starredAt: 'desc' },
    take: 200,
    include: {
      message: {
        include: {
          sender: { select: USER_SELECT },
          conversation: {
            include: {
              participants: true,
              messages: { orderBy: { createdAt: 'desc' }, take: 1 },
            },
          },
        },
      },
    },
  });

  const rows = [];
  const validStars = [];
  for (const star of stars) {
    const message = star.message;
    if (!message?.conversation) continue;
    if (!message.conversation.participants.some((p) => p.userId === viewerId)) continue;
    validStars.push(star);
  }

  const convById = new Map();
  for (const star of validStars) {
    convById.set(star.message.conversationId, star.message.conversation);
  }
  const formattedById = new Map();
  if (convById.size) {
    const formatted = await hydrateConversations([...convById.values()], viewerId);
    for (const c of formatted) formattedById.set(c.id, c);
  }

  const starMeta = await getMessageStarMeta(
    viewerId,
    validStars.map((s) => s.message.id),
  );

  for (const star of validStars) {
    const message = star.message;
    const formattedConv = formattedById.get(message.conversationId);
    if (!formattedConv) continue;
    rows.push({
      starredAt: star.starredAt,
      message: mapInboxMessage(message, viewerId, null, starMeta),
      conversation: {
        id: formattedConv.id,
        isGroup: formattedConv.isGroup,
        name: formattedConv.name,
        otherUser: formattedConv.otherUser,
      },
    });
  }
  return rows;
}

module.exports = {
  listConversations,
  loadConversationForMember,
  getConversationMessages,
  inboxMessageStatus,
  setConversationStarred,
  setMessageStarred,
  listStarredMessages,
  sortInboxConversations,
};
