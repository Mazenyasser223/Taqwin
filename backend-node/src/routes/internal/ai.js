/**
 * Block A4 — internal AI routes (FastAPI only, X-Internal-Key).
 *
 *   POST /api/internal/ai/tools/execute
 *     body: { userId, toolName, input?, threadId? }
 *     returns: { success, output, error?, executionId }
 */
const express = require('express');
const { z } = require('zod');
const { internalAuthMiddleware } = require('../../middleware/internalAuth');
const { validate } = require('../../middleware/validate');
const { executeTool } = require('../../services/aiToolExecutor');

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

module.exports = router;
