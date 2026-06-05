/**
 * Block A4 / B5 — internal AI routes (FastAPI only, X-Internal-Key).
 *
 *   POST /api/internal/ai/tools/execute
 *     body: { userId, toolName, input?, threadId? }
 *     returns: { success, output, error?, executionId }
 *
 *   POST /api/internal/ai/rag/search
 *     body: { query, levels, limit?, locale?, minScore? }
 *     returns: { query, levels, limit, embedding, results[] }
 */
const express = require('express');
const { z } = require('zod');
const { internalAuthMiddleware } = require('../../middleware/internalAuth');
const { validate } = require('../../middleware/validate');
const { executeTool } = require('../../services/aiToolExecutor');
const { searchKnowledge } = require('../../lib/rag/pgvectorSearch');
const { logger } = require('../../lib/logger');

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

router.post('/tools/execute', validate(executeSchema), async (req, res) => {
  const { userId, toolName, input, threadId } = req.body;
  const result = await executeTool({ userId, toolName, input, threadId });
  res.status(result.success ? 200 : 422).json(result);
});

const knowledgeLevel = z.enum([
  'L1_INTERNAL',
  'L2_EXERCISE',
  'L3_NUTRITION',
  'L4_SCIENTIFIC',
  'L5_BOOKS',
]);

const ragSearchSchema = z.object({
  body: z.object({
    query: z.string().min(1).max(2000),
    levels: z.array(knowledgeLevel).min(1).max(5),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    locale: z.enum(['en', 'ar']).optional(),
    minScore: z.coerce.number().min(0).max(1).optional(),
  }),
});

router.post('/rag/search', validate(ragSearchSchema), async (req, res, next) => {
  try {
    const { query, levels, limit, locale, minScore } = req.body;
    const payload = await searchKnowledge({ query, levels, limit, locale, minScore });
    res.json(payload);
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

module.exports = router;
