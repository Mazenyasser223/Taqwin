/**
 * Block E4 — enqueue LLM memory summarization after substantive chat sessions.
 *
 * Fires when user message count crosses multiples of AI_MEMORY_SESSION_MIN_TURNS
 * (default 5). Uses Redis milestone dedupe per conversation so we do not enqueue
 * on every turn after the threshold.
 */
const { isMongoConfigured, connectMongo } = require('../../db/mongo/client');
const { redisGetJson, redisSetJson } = require('../redis');
const { isPlanQueueEnabled } = require('../redisBull');
const { enqueueMemorySummarize, MEMORY_SOURCES } = require('./memoryEvents');
const { logger } = require('../logger');

const MILESTONE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isSessionMemoryTriggerEnabled() {
  const flag = (process.env.FEATURE_AI_MEMORY_SESSION || '').toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'no') return false;
  if (flag === 'true' || flag === '1' || flag === 'yes') return true;
  return false;
}

function getSessionMinTurns() {
  const n = Number(process.env.AI_MEMORY_SESSION_MIN_TURNS);
  return Number.isFinite(n) && n >= 2 ? Math.floor(n) : 12;
}

function getSessionSummarizeHours() {
  const n = Number(process.env.AI_MEMORY_SESSION_HOURS);
  return Number.isFinite(n) && n >= 1 ? Math.min(168, Math.floor(n)) : 24;
}

function milestoneRedisKey(conversationId) {
  return `ai-memory-milestone:${conversationId}`;
}

/**
 * @param {{ userId: string, conversationId: string, locale?: 'ar'|'en', meta?: object }} args
 */
async function maybeEnqueueMemoryAfterSession({ userId, conversationId, locale = 'ar', meta = {} }) {
  if (!isSessionMemoryTriggerEnabled()) return { ok: false, reason: 'disabled' };
  if (!userId || !conversationId) return { ok: false, reason: 'missing_ids' };
  if (meta.offTopic) return { ok: false, reason: 'off_topic' };
  if (!isPlanQueueEnabled()) return { ok: false, reason: 'queue_disabled' };
  if (!isMongoConfigured()) return { ok: false, reason: 'mongo_unconfigured' };

  const minTurns = getSessionMinTurns();

  let Message;
  try {
    await connectMongo();
    Message = require('../../db/mongo/models/message');
  } catch (err) {
    logger.debug({ err, userId }, 'memory session trigger: mongo unavailable');
    return { ok: false, reason: 'mongo_unavailable' };
  }

  const userMsgCount = await Message.countDocuments({
    conversationId,
    role: 'user',
  });
  if (userMsgCount < minTurns) {
    return { ok: true, skipped: true, reason: 'below_threshold', userMsgCount, minTurns };
  }

  const milestone = Math.floor(userMsgCount / minTurns) * minTurns;
  const cacheKey = milestoneRedisKey(conversationId);
  const cached = await redisGetJson(cacheKey);
  if (cached?.milestone >= milestone) {
    return { ok: true, skipped: true, reason: 'milestone_done', milestone };
  }

  const result = await enqueueMemorySummarize({
    userId,
    locale: locale === 'en' ? 'en' : 'ar',
    hours: getSessionSummarizeHours(),
    source: MEMORY_SOURCES.SESSION_CHAT,
  });

  if (result.ok) {
    await redisSetJson(cacheKey, { milestone, enqueuedAt: new Date().toISOString() }, MILESTONE_TTL_MS);
    logger.info(
      { userId, conversationId, milestone, userMsgCount, jobId: result.jobId },
      'ai-memory session summarize enqueued'
    );
  }

  return { ...result, milestone, userMsgCount };
}

module.exports = {
  maybeEnqueueMemoryAfterSession,
  isSessionMemoryTriggerEnabled,
  getSessionMinTurns,
  getSessionSummarizeHours,
  milestoneRedisKey,
};
