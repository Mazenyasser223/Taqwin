/**
 * Block A5 — Chat memory: Redis hot cache + Mongo persistence.
 *
 * Redis key: chat:ctx:{threadId} — last 20 messages (24h TTL).
 * Mongo: ai_conversations + ai_messages (source of truth).
 */
const { redisGetJson, redisSetJson } = require('./redis');
const { isMongoConfigured, connectMongo } = require('../db/mongo/client');

const CHAT_CTX_TTL_MS = 24 * 60 * 60 * 1000;
const REDIS_MESSAGE_CAP = 20;
const HISTORY_TAKE = 12;

function chatCtxKey(threadId) {
  return `chat:ctx:${threadId}`;
}

async function loadModels() {
  if (!isMongoConfigured()) return null;
  try {
    await connectMongo();
  } catch {
    return null;
  }
  return {
    Conversation: require('../db/mongo/models/conversation'),
    Message: require('../db/mongo/models/message'),
  };
}

function toLlmMessage(doc) {
  if (!doc || (doc.role !== 'user' && doc.role !== 'assistant')) return null;
  return {
    role: doc.role === 'assistant' ? 'model' : 'user',
    content: doc.content,
  };
}

function trimMessages(messages, limit) {
  return messages.slice(-limit);
}

async function loadRecentMessages(userId, threadId, { limit = REDIS_MESSAGE_CAP } = {}) {
  if (!threadId) return [];

  const cached = await redisGetJson(chatCtxKey(threadId));
  if (cached?.userId === userId && Array.isArray(cached.messages)) {
    return trimMessages(cached.messages, limit);
  }

  const models = await loadModels();
  if (!models) return [];

  let conversation = null;
  try {
    conversation = await models.Conversation.findOne({ _id: threadId, userId }).lean();
  } catch {
    return [];
  }
  if (!conversation) return [];

  const recent = await models.Message.find({ conversationId: conversation._id })
    .sort({ createdAt: -1 })
    .limit(REDIS_MESSAGE_CAP)
    .lean();

  const messages = recent
    .reverse()
    .map(toLlmMessage)
    .filter(Boolean);

  await redisSetJson(
    chatCtxKey(threadId),
    { userId, messages },
    CHAT_CTX_TTL_MS
  );

  return trimMessages(messages, limit);
}

async function warmChatCache(userId, threadId, messages) {
  if (!threadId) return;
  await redisSetJson(
    chatCtxKey(threadId),
    { userId, messages: trimMessages(messages, REDIS_MESSAGE_CAP) },
    CHAT_CTX_TTL_MS
  );
}

/**
 * @returns {Promise<{ historyMessages: Array<{role: string, content: string}>, conversation: object|null }>}
 */
async function resolveHistory({ userId, conversationId, locale, limit = HISTORY_TAKE }) {
  const models = await loadModels();
  if (!models) return { historyMessages: [], conversation: null };

  let conversation = null;
  if (conversationId) {
    try {
      conversation = await models.Conversation.findOne({ _id: conversationId, userId }).lean();
    } catch {
      conversation = null;
    }
  }

  if (!conversation) return { historyMessages: [], conversation: null };

  const threadId = conversation._id.toString();
  const historyMessages = await loadRecentMessages(userId, threadId, { limit });
  void locale;
  return { historyMessages, conversation };
}

/**
 * Persist a user + assistant turn to Mongo and refresh Redis cache.
 * @returns {Promise<string|null>} conversationId
 */
async function appendTurn({
  userId,
  conversationId,
  locale,
  userMessage,
  assistantReply,
  meta = {},
}) {
  const models = await loadModels();
  if (!models) return null;

  let convDoc = null;
  if (conversationId) {
    try {
      convDoc = await models.Conversation.findOne({ _id: conversationId, userId });
    } catch {
      convDoc = null;
    }
  }

  if (!convDoc) {
    convDoc = await models.Conversation.create({
      userId,
      locale,
      title: (userMessage || '').slice(0, 60),
      lastMessageAt: new Date(),
    });
  } else {
    convDoc.lastMessageAt = new Date();
    if (!convDoc.title && userMessage) convDoc.title = userMessage.slice(0, 60);
    await convDoc.save();
  }

  await models.Message.insertMany([
    { conversationId: convDoc._id, userId, role: 'user', content: userMessage || '', meta: {} },
    {
      conversationId: convDoc._id,
      userId,
      role: 'assistant',
      content: assistantReply || '',
      meta,
    },
  ]);

  const threadId = convDoc._id.toString();
  const recent = await models.Message.find({ conversationId: convDoc._id })
    .sort({ createdAt: -1 })
    .limit(REDIS_MESSAGE_CAP)
    .lean();
  const messages = recent
    .reverse()
    .map(toLlmMessage)
    .filter(Boolean);
  await warmChatCache(userId, threadId, messages);

  void require('./ai/memorySessionTrigger')
    .maybeEnqueueMemoryAfterSession({
      userId,
      conversationId: convDoc._id,
      locale,
      meta,
    })
    .catch(() => null);

  return threadId;
}

module.exports = {
  resolveHistory,
  appendTurn,
  loadRecentMessages,
  warmChatCache,
  chatCtxKey,
  HISTORY_TAKE,
  REDIS_MESSAGE_CAP,
};
