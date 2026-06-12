/**
 * Block E4 — nightly chat → AiMemory summarization pipeline.
 */
const { isMongoConfigured, connectMongo } = require('../../db/mongo/client');
const { logger } = require('../logger');
const { isFastApiBridgeEnabled, memorySummarizeViaFastApi } = require('../../services/aiFastApiClient');
const { upsertAiMemory } = require('../../services/aiMemoryService');
const { isSemanticMemoryKey } = require('./aiMemoryKeys');
const { MEMORY_SOURCES } = require('./memoryEvents');

function parseMemoriesJson(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];
  try {
    const data = JSON.parse(text);
    return Array.isArray(data.memories) ? data.memories : [];
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        const data = JSON.parse(text.slice(start, end + 1));
        return Array.isArray(data.memories) ? data.memories : [];
      } catch {
        return [];
      }
    }
    return [];
  }
}

async function loadModels() {
  if (!isMongoConfigured()) return null;
  await connectMongo();
  return {
    Message: require('../../db/mongo/models/message'),
  };
}

/**
 * @param {string} userId
 * @param {{ hours?: number, limit?: number }} [opts]
 */
async function fetchRecentChatTranscript(userId, opts = {}) {
  const models = await loadModels();
  if (!models) return '';

  const hours = Math.min(168, Math.max(1, Number(opts.hours) || 48));
  const limit = Math.min(80, Math.max(5, Number(opts.limit) || 40));
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const msgs = await models.Message.find({
    userId,
    role: { $in: ['user', 'assistant'] },
    createdAt: { $gte: since },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  if (!msgs.length) return '';

  return msgs
    .reverse()
    .map((m) => `${m.role}: ${String(m.content || '').slice(0, 800)}`)
    .join('\n');
}

/**
 * @param {string} userId
 * @param {{ locale?: 'ar'|'en', hours?: number, dryRun?: boolean }} [opts]
 */
async function summarizeUserMemories(userId, opts = {}) {
  const started = Date.now();
  const locale = opts.locale === 'en' ? 'en' : 'ar';
  const source =
    opts.source === MEMORY_SOURCES.SESSION_CHAT
      ? MEMORY_SOURCES.SESSION_CHAT
      : opts.source === MEMORY_SOURCES.TOOL_SUCCESS
        ? MEMORY_SOURCES.TOOL_SUCCESS
        : MEMORY_SOURCES.NIGHTLY_CHAT;

  const transcript = await fetchRecentChatTranscript(userId, { hours: opts.hours });
  if (!transcript || transcript.length < 40) {
    return { ok: true, skipped: true, reason: 'insufficient_chat', written: 0, source };
  }

  if (opts.dryRun) {
    return { ok: true, dryRun: true, chars: transcript.length, written: 0, source };
  }

  if (!isFastApiBridgeEnabled()) {
    return {
      ok: false,
      reason: 'ai_service_not_configured — set FEATURE_AI_VIA_FASTAPI=true and AI_SERVICE_URL',
      written: 0,
      source,
    };
  }

  let items;
  try {
    const result = await memorySummarizeViaFastApi({
      transcript: transcript.slice(0, 12000),
      locale,
      temperature: 0.2,
      maxTokens: 900,
    });
    if (result.skipped) {
      return {
        ok: true,
        skipped: true,
        reason: result.reason || 'insufficient_chat',
        written: 0,
        source,
        latencyMs: Date.now() - started,
      };
    }
    items =
      Array.isArray(result.memories) && result.memories.length
        ? result.memories
        : parseMemoriesJson(result.raw);
  } catch (err) {
    logger.warn({ err, userId, source, latencyMs: Date.now() - started }, 'memory summarize via FastAPI failed');
    return { ok: false, reason: err.message || 'llm_failed', written: 0, source };
  }

  const keysWritten = [];
  let written = 0;
  for (const item of items) {
    const key = String(item.key || '').trim();
    const summary = String(item.summary || '').trim();
    if (!isSemanticMemoryKey(key) || summary.length < 8) continue;
    const confidence = Number(item.confidence);
    await upsertAiMemory({
      userId,
      key,
      summary,
      confidence: Number.isFinite(confidence) ? confidence : 0.75,
      source,
    });
    keysWritten.push(key);
    written += 1;
  }

  const latencyMs = Date.now() - started;
  const model = process.env.ANTHROPIC_MODEL || 'claude';
  logger.info({ userId, source, keysWritten, model, latencyMs, written }, 'ai-memory summarize completed');

  return { ok: true, written, locale, keys: keysWritten, source, model, latencyMs };
}

module.exports = {
  fetchRecentChatTranscript,
  summarizeUserMemories,
  parseMemoriesJson,
};
