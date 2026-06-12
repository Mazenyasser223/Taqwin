/**
 * Block A4 / B5 — internal AI routes (FastAPI only, X-Internal-Key).
 *
 *   POST /api/internal/ai/tools/execute
 *     body: { userId, toolName, input?, threadId? }
 *     returns: { success, output, error?, executionId }
 *
 *   GET /api/internal/ai/debug/context/:userId
 *     returns: last CAG bundle (fresh from DB)
 *
 *   POST /api/internal/ai/rag/search
 *     body: { query, levels, limit?, locale?, minScore? }
 *     returns: { query, levels, limit, embedding, results[] }
 */
const express = require('express');
const { z } = require('zod');
const { internalAuthMiddleware } = require('../../middleware/internalAuth');
const { validate } = require('../../middleware/validate');
const { internalAiToolsLimiter } = require('../../middleware/rateLimitApi');
const { executeTool, listChatTools } = require('../../services/aiToolExecutor');
const { buildContextBundleFresh } = require('../../lib/contextBundle');
const { ragRetrieve } = require('../../lib/rag/ragRetrieve');
const { logger } = require('../../lib/logger');
const { logAgentTrace } = require('../../services/agentTraceService');
const { readAiMemories, upsertAiMemory } = require('../../services/aiMemoryService');
const { isSemanticMemoryKey } = require('../../lib/ai/aiMemoryKeys');

const router = express.Router();
router.use(internalAuthMiddleware);

const executeSchema = z.object({
  body: z.object({
    userId: z.string().uuid(),
    toolName: z.string().min(1).max(128),
    input: z.record(z.unknown()).optional().default({}),
    threadId: z.string().max(128).optional(),
  }),
});

const userIdParamSchema = z.object({
  params: z.object({
    userId: z.string().uuid(),
  }),
});

router.post('/tools/execute', internalAiToolsLimiter, validate(executeSchema), async (req, res) => {
  const { userId, toolName, input, threadId } = req.body;
  const result = await executeTool({ userId, toolName, input, threadId });
  res.status(result.success ? 200 : 422).json(result);
});

router.get('/debug/context/:userId', validate(userIdParamSchema), async (req, res, next) => {
  try {
    const bundle = await buildContextBundleFresh(req.params.userId);
    res.json(bundle);
  } catch (err) {
    logger.error({ err, userId: req.params.userId }, 'GET /internal/ai/debug/context failed');
    next(err);
  }
});

const knowledgeLevel = z.enum([
  'L1_INTERNAL',
  'L2_EXERCISE',
  'L3_NUTRITION',
  'L5_BOOKS',
]);

const ragSearchSchema = z.object({
  body: z.object({
    query: z.string().min(1).max(2000),
    levels: z.array(knowledgeLevel).min(1).max(4),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    locale: z.enum(['en', 'ar']).optional(),
    minScore: z.coerce.number().min(0).max(1).optional(),
  }),
});

const traceSchema = z.object({
  body: z.object({
    userId: z.string().uuid(),
    threadId: z.string().max(128).optional(),
    turnId: z.string().uuid().optional(),
    intent: z.string().max(64).optional(),
    routing: z.record(z.unknown()).optional(),
    rag: z.record(z.unknown()).optional(),
    cag: z.record(z.unknown()).optional(),
    llm: z.record(z.unknown()).optional(),
    tools: z.record(z.unknown()).optional(),
    nodes: z.array(z.record(z.unknown())).optional(),
    toolCalls: z.array(z.record(z.unknown())).optional(),
    latencyMs: z.number().optional(),
    model: z.string().max(128).optional(),
    locale: z.enum(['en', 'ar']).optional(),
    success: z.boolean().optional(),
    error: z.string().max(2000).optional(),
  }),
});

router.post('/traces', internalAiToolsLimiter, validate(traceSchema), async (req, res) => {
  const traceId = await logAgentTrace(req.body);
  res.status(201).json({ ok: true, traceId });
});

const memoryReadSchema = z.object({
  query: z.object({
    userId: z.string().uuid(),
    keys: z.string().optional(),
  }),
});

router.get('/memory/read', validate(memoryReadSchema), async (req, res, next) => {
  try {
    const keys = req.query.keys
      ? String(req.query.keys)
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean)
      : undefined;
    const rows = await readAiMemories({ userId: req.query.userId, keys });
    res.json({ memories: rows });
  } catch (err) {
    next(err);
  }
});

const memoryWriteSchema = z.object({
  body: z.object({
    userId: z.string().uuid(),
    key: z.string().min(1).max(64),
    summary: z.string().min(1).max(4000),
    confidence: z.number().min(0).max(1).optional(),
    source: z.string().max(64).optional(),
  }),
});

router.post('/memory/write', internalAiToolsLimiter, validate(memoryWriteSchema), async (req, res, next) => {
  try {
    if (!isSemanticMemoryKey(req.body.key)) {
      return res.status(400).json({
        error: 'key must be a semantic memory key (diet_preferences, training_constraints, injury_notes, goals_mentioned, chat_context_summary)',
      });
    }
    const row = await upsertAiMemory(req.body);
    res.status(201).json({ memory: row });
  } catch (err) {
    next(err);
  }
});

router.post('/rag/search', validate(ragSearchSchema), async (req, res, next) => {
  try {
    const { query, levels, limit, locale, minScore } = req.body;
    const traceId = req.requestId || req.headers['x-request-id'] || null;
    const payload = await ragRetrieve({
      purpose: 'chat',
      query,
      levels,
      limit,
      locale,
      minScore,
      traceId,
    });
    const { trace, ...body } = payload;
    res.json({ ...body, trace });
  } catch (err) {
    if (err.code === 'EMBEDDINGS_NOT_CONFIGURED') {
      return res.status(503).json({ error: err.message });
    }
    if (/required|Invalid knowledge level|Failed to embed/i.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    logger.error({ err }, 'RAG search failed');
    next(err);
  }
});

router.get('/tools/list', internalAiToolsLimiter, (_req, res) => {
  const tools = listChatTools();
  res.json({ tools, count: tools.length });
});

module.exports = router;
