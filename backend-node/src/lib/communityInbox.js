/**
 * Direct messages — find/create 1:1 conversations and send inbox messages.
 */
const { prisma } = require('../db');
const { isMutualFollow } = require('./communityPrivacy');
const { notifyWithActor } = require('./communityNotify');

async function isBlockedBetween(userIdA, userIdB) {
  const row = await prisma.communityBlock.findFirst({
    where: {
      OR: [
        { blockerId: userIdA, blockedId: userIdB },
        { blockerId: userIdB, blockedId: userIdA },
      ],
    },
  });
  return Boolean(row);
}

async function findExistingDirectConversation(userIdA, userIdB) {
  const membershipsA = await prisma.communityConversationParticipant.findMany({
    where: { userId: userIdA },
    select: { conversationId: true },
  });
  const convIds = membershipsA.map((m) => m.conversationId);
  if (!convIds.length) return null;

  const shared = await prisma.communityConversationParticipant.findMany({
    where: { userId: userIdB, conversationId: { in: convIds } },
    select: { conversationId: true },
  });

  for (const { conversationId } of shared) {
    const parts = await prisma.communityConversationParticipant.findMany({
      where: { conversationId },
    });
    if (parts.length === 2) {
      return prisma.communityConversation.findUnique({ where: { id: conversationId } });
    }
  }
  return null;
}

/**
 * @returns {Promise<{ conversation: object, created: boolean }>}
 */
async function getOrCreateDirectConversation(initiatorId, participantId) {
  if (initiatorId === participantId) {
    throw new Error('Cannot message yourself');
  }
  if (await isBlockedBetween(initiatorId, participantId)) {
    throw new Error('You cannot message this user');
  }

  const existing = await findExistingDirectConversation(initiatorId, participantId);
  if (existing) return { conversation: existing, created: false };

  const mutual = await isMutualFollow(initiatorId, participantId);
  const conversation = await prisma.communityConversation.create({
    data: {
      status: mutual ? 'active' : 'pending',
      initiatedById: initiatorId,
      participants: {
        create: [{ userId: initiatorId }, { userId: participantId }],
      },
    },
  });

  if (!mutual) {
    await notifyWithActor({
      userId: participantId,
      actorId: initiatorId,
      type: 'community.message_request',
      title: 'sent you a message request',
      link: '/community/inbox?folder=requests',
    });
  }

  return { conversation, created: true };
}

/**
 * Send a DM that appears in the recipient's inbox (Primary or Requests).
 */
async function sendDirectMessage({ senderId, recipientId, content, messageType = 'text', mediaUrl = null }) {
  let { conversation } = await getOrCreateDirectConversation(senderId, recipientId);
  const trimmed = (content || '').trim();
  if (!trimmed && !mediaUrl) {
    throw new Error('Message content or media is required');
  }

  // Story replies should always land in inbox (activate thread if it was a pending request).
  if (messageType === 'story_reply' && conversation.status === 'pending') {
    conversation = await prisma.communityConversation.update({
      where: { id: conversation.id },
      data: { status: 'active' },
    });
  } else if (
    conversation.status === 'pending' &&
    conversation.initiatedById !== senderId
  ) {
    throw new Error('Accept the message request before replying');
  }

  const message = await prisma.$transaction(async (tx) => {
    const msg = await tx.communityMessage.create({
      data: {
        conversationId: conversation.id,
        senderId,
        messageType,
        content: trimmed || (messageType === 'image' ? '📷 Photo' : ''),
        mediaUrl,
      },
    });
    await tx.communityConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });
    return msg;
  });

  if (recipientId !== senderId) {
    const preview =
      messageType === 'story_reply'
        ? trimmed
        : trimmed.slice(0, 120);
    await notifyWithActor({
      userId: recipientId,
      actorId: senderId,
      type: 'community.message',
      title: messageType === 'story_reply' ? 'replied to your story' : 'sent you a message',
      message: preview,
      link: `/community/inbox?c=${conversation.id}`,
    });
  }

  return { conversation, message };
}

module.exports = {
  getOrCreateDirectConversation,
  sendDirectMessage,
  isBlockedBetween,
};
