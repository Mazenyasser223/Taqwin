/**
 * AI proxy — coach chat via ai-service (FastAPI).
 *
 *   POST /api/ai/chat
 *   POST /api/ai/chat/confirm   { conversationId, actionId }
 *   POST /api/ai/chat/cancel    { conversationId, actionId }
 *   POST /api/ai/chat/disambiguate { actionId, foodItemId|webtebId }
 *   GET  /api/ai/chat/pending?conversationId=
 */
const express = require('express');
const { z } = require('zod');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { logger } = require('../lib/logger');
const { processCoachChatTurn } = require('../services/coachChatTurn');
const {
  processCoachConfirm,
  processCoachCancel,
  processCoachDisambiguate,
  coachActionErrorBody,
} = require('../services/coachChatActions');
const { captureException } = require('../lib/sentry');
const { getActivePendingForConversation } = require('../services/pendingActionService');
const { pendingForClient } = require('../lib/coach/foodDisambiguation');
const planRoutes = require('./ai/plan');
const conversationsRoutes = require('./ai/conversations');
const notifyRoutes = require('./ai/notify');

const router = express.Router();
router.use(authMiddleware);
router.use('/plan', planRoutes);
router.use('/conversations', conversationsRoutes);
router.use('/notify', notifyRoutes);

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.AI_RATE_LIMIT_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip),
  message: { error: 'AI request rate limit exceeded. Slow down.' },
});

const chatSchema = z.object({
  body: z.object({
    messages: z
      .array(
        z.object({
          role: z.enum(['user', 'model']),
          content: z.string().min(1).max(4000),
        })
      )
      .min(1)
      .max(40),
    locale: z.enum(['en', 'ar']).optional(),
    conversationId: z.string().optional(),
    threadId: z.string().max(128).optional(),
  }),
});

const actionIdSchema = z.object({
  body: z.object({
    conversationId: z.string().optional(),
    actionId: z.string().uuid(),
    locale: z.enum(['en', 'ar']).optional(),
    confirmationPhrase: z.string().max(64).optional(),
    password: z.string().max(128).optional(),
  }),
});

const disambiguateSchema = z.object({
  body: z.object({
    conversationId: z.string().optional(),
    actionId: z.string().uuid(),
    foodItemId: z.string().uuid().optional(),
    webtebId: z.coerce.number().int().positive().optional(),
    locale: z.enum(['en', 'ar']).optional(),
  }).refine((b) => Boolean(b.foodItemId || b.webtebId), {
    message: 'foodItemId or webtebId is required',
  }),
});

const pendingQuerySchema = z.object({
  query: z.object({
    conversationId: z.string().min(1),
  }),
});

router.post('/chat/confirm', aiLimiter, validate(actionIdSchema), async (req, res) => {
  const result = await processCoachConfirm(req.user.id, req.body);
  if (!result.ok) {
    return res.status(result.status || 500).json(coachActionErrorBody(result));
  }
  return res.json(result.data);
});

router.post('/chat/cancel', aiLimiter, validate(actionIdSchema), async (req, res) => {
  const result = await processCoachCancel(req.user.id, req.body);
  if (!result.ok) return res.status(result.status || 500).json({ error: result.error });
  return res.json(result.data);
});

router.get('/chat/pending', aiLimiter, validate(pendingQuerySchema), async (req, res) => {
  try {
    const pending = await getActivePendingForConversation(req.user.id, req.query.conversationId);
    if (!pending) {
      return res.json({ pending: null });
    }
    return res.json({ pending: pendingForClient(pending) });
  } catch (err) {
    logger.error({ err }, 'GET /api/ai/chat/pending failed');
    return res.status(500).json({ error: 'Failed to load pending action' });
  }
});

router.post('/chat/disambiguate', aiLimiter, validate(disambiguateSchema), async (req, res) => {
  try {
    const result = await processCoachDisambiguate(req.user.id, req.body);
    if (!result.ok) return res.status(result.status || 500).json({ error: result.error });
    return res.json(result.data);
  } catch (err) {
    logger.error({ err }, 'POST /api/ai/chat/disambiguate failed');
    return res.status(500).json({ error: 'Disambiguation failed' });
  }
});

router.post('/chat', aiLimiter, validate(chatSchema), async (req, res) => {
  try {
    const { messages, locale: bodyLocale, conversationId, threadId: bodyThreadId } = req.body;
    const result = await processCoachChatTurn(req.user.id, {
      messages,
      locale: bodyLocale,
      conversationId,
      threadId: bodyThreadId || conversationId,
    });
    if (!result.ok) {
      return res.status(result.status || 502).json({ error: result.error });
    }
    return res.json(result.data);
  } catch (err) {
    logger.error({ err }, 'AI chat failed');
    captureException(err, { route: 'POST /api/ai/chat', userId: req.user?.id });
    res.status(502).json({ error: 'AI request failed' });
  }
});

module.exports = router;
