/**
 * Block E4 — unified memory event enqueue (production pipeline).
 *
 * All memory writes flow: event enqueue → BullMQ → ai-service /memory/summarize → AiMemory.
 * Node never writes durable facts directly; it only enqueues summarize jobs.
 */
const { redisGetJson, redisSetJson } = require('../redis');
const { isPlanQueueEnabled } = require('../redisBull');
const { enqueueAiMemorySummarize } = require('../../jobs/aiMemoryJobs');
const { logger } = require('../logger');

/** Canonical summarize job sources (matches memoryPipeline + worker). */
const MEMORY_SOURCES = Object.freeze({
  SESSION_CHAT: 'session_chat',
  TOOL_SUCCESS: 'tool_success',
  NIGHTLY_CHAT: 'nightly_chat',
});

const TOOL_MEMORY_DEBOUNCE_MS = 30 * 60 * 1000;

const TOOL_SUMMARIZE_TOOLS = new Set([
  'log_food',
  'replace_exercise_today',
  'replace_meal_today',
  'set_life_mode',
  'adapt_plan',
  'update_weight',
  'record_readiness',
  'skip_day',
]);

function toolMemoryDebounceKey(userId) {
  return `ai-memory-tool-debounce:${userId}`;
}

/**
 * Enqueue a memory summarize job (single entry for session, tool, nightly triggers).
 * @param {{ userId: string, source: string, locale?: 'ar'|'en', hours?: number, dryRun?: boolean }} args
 */
async function enqueueMemorySummarize({
  userId,
  source = MEMORY_SOURCES.NIGHTLY_CHAT,
  locale = 'ar',
  hours = 48,
  dryRun = false,
} = {}) {
  if (!userId) return { ok: false, reason: 'missing_user' };
  if (!isPlanQueueEnabled()) return { ok: false, reason: 'queue_disabled' };

  const normalizedSource =
    source === MEMORY_SOURCES.SESSION_CHAT
      ? MEMORY_SOURCES.SESSION_CHAT
      : source === MEMORY_SOURCES.TOOL_SUCCESS
        ? MEMORY_SOURCES.TOOL_SUCCESS
        : MEMORY_SOURCES.NIGHTLY_CHAT;

  const result = await enqueueAiMemorySummarize({
    userId,
    locale: locale === 'en' ? 'en' : 'ar',
    hours,
    dryRun,
    source: normalizedSource,
  });

  if (result.ok) {
    logger.debug({ userId, source: normalizedSource, jobId: result.jobId }, 'memory event enqueued');
  }
  return result;
}

/**
 * Post-tool memory event — debounced enqueue only (no direct AiMemory writes).
 * @param {{ userId: string, toolName: string, locale?: 'ar'|'en' }} args
 */
async function enqueueMemoryAfterTool({ userId, toolName, locale = 'ar' }) {
  if (!TOOL_SUMMARIZE_TOOLS.has(toolName)) return { ok: false, reason: 'not_tracked' };
  if (!isPlanQueueEnabled()) return { ok: false, reason: 'queue_disabled' };

  const cacheKey = toolMemoryDebounceKey(userId);
  const cached = await redisGetJson(cacheKey);
  if (cached?.at && Date.now() - cached.at < TOOL_MEMORY_DEBOUNCE_MS) {
    return { ok: true, skipped: true, reason: 'debounced' };
  }

  const result = await enqueueMemorySummarize({
    userId,
    locale: locale === 'en' ? 'en' : 'ar',
    hours: 24,
    source: MEMORY_SOURCES.TOOL_SUCCESS,
  });

  if (result.ok) {
    await redisSetJson(cacheKey, { at: Date.now(), toolName }, TOOL_MEMORY_DEBOUNCE_MS);
  }
  return result;
}

module.exports = {
  MEMORY_SOURCES,
  TOOL_SUMMARIZE_TOOLS,
  TOOL_MEMORY_DEBOUNCE_MS,
  toolMemoryDebounceKey,
  enqueueMemorySummarize,
  enqueueMemoryAfterTool,
};
