/**
 * AI proxy — server-side LLM (Ollama / Claude / Gemini). API keys never reach the browser.
 *
 *   POST /api/ai/chat
 *     body: { messages, locale?, conversationId?, threadId? }
 *     When FEATURE_AI_VIA_FASTAPI=true → proxies to ai-service /chat; else Node LLM.
 *     Returns: { reply: string, conversationId? }
 *
 *   GET  /api/ai/plan/me, POST /api/ai/plan/{generate,regenerate}
 *     See routes/ai/plan.js
 */
const express = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { logger } = require('../lib/logger');
const { buildCoachSystemPrompt } = require('../lib/coachPrompt');
const { buildCoachUserContext } = require('../lib/coachContext');
const { buildCoachFoodContext } = require('../lib/coachFoodContext');
const { retrieveBookChunks, formatBookChunkForPrompt } = require('../lib/rag/retrieveBook');
const { completeChat, providerConfigHint } = require('../services/aiChatProvider');
const { isFastApiBridgeEnabled, chatViaFastApi } = require('../services/aiFastApiClient');
const { checkOffTopic } = require('../lib/coach/offTopicGuard');
const { buildContextBundle } = require('../lib/contextBundle');
const { resolveHistory, appendTurn } = require('../lib/chatMemory');
const planRoutes = require('./ai/plan');
const conversationsRoutes = require('./ai/conversations');

const router = express.Router();
router.use(authMiddleware);
router.use('/plan', planRoutes);
router.use('/conversations', conversationsRoutes);

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.AI_RATE_LIMIT_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
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
    /** Optional thread id for FastAPI (defaults to conversationId). Block A3. */
    threadId: z.string().max(128).optional(),
  }),
});

router.post('/chat', aiLimiter, validate(chatSchema), async (req, res) => {
  try {
    const { messages, locale: bodyLocale, conversationId, threadId: bodyThreadId } = req.body;
    const threadId = bodyThreadId || conversationId || undefined;

    const ctx = await buildCoachUserContext(req.user.id);
    const locale = bodyLocale === 'en' || bodyLocale === 'ar' ? bodyLocale : ctx.locale;
    const contextBundle = await buildContextBundle(req.user.id);

    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

    // Off-topic guard: short-circuit unrelated requests with a fixed reply.
    const guardResult = await checkOffTopic(lastUserMsg, { locale }).catch(() => ({
      inDomain: true,
      reason: 'guard-error',
    }));
    if (!guardResult.inDomain && guardResult.offTopicReply) {
      const reply = guardResult.offTopicReply;
      await appendTurn({
        userId: req.user.id,
        conversationId,
        locale,
        userMessage: lastUserMsg,
        assistantReply: reply,
        meta: { offTopic: true, reason: guardResult.reason },
      }).catch(() => null);
      return res.json({ reply, offTopic: true });
    }

    const { historyMessages, conversation } = await resolveHistory({
      userId: req.user.id,
      conversationId,
      locale,
    });

    const llmMessages = [...historyMessages, ...messages].slice(-30);

    let reply = '';
    let viaFastApi = false;
    let fastApiMeta = {};

    if (isFastApiBridgeEnabled()) {
      try {
        const fastApi = await chatViaFastApi({
          userId: req.user.id,
          threadId,
          messages: llmMessages,
          locale,
          contextBundle,
        });
        reply = fastApi.reply;
        viaFastApi = true;
        fastApiMeta = {
          intent: fastApi.intent,
          toolCalls: fastApi.toolCalls?.length || 0,
          confirmationRequired: fastApi.confirmationRequired,
        };
      } catch (err) {
        logger.warn({ err }, 'FastAPI chat failed; falling back to Node LLM');
      }
    }

    let bookChunks = [];
    if (!viaFastApi) {
      const foodContext = await buildCoachFoodContext({
        profile: ctx.profile,
        onboarding: ctx.onboarding,
        messages,
        lang: locale,
      });

      bookChunks = await retrieveBookChunks({
        profile: ctx.profile,
        onboardingData: ctx.profile?.onboardingData,
        message: lastUserMsg,
        limit: 3,
      }).catch(() => []);
      const bookContext = bookChunks.length
        ? bookChunks.map(formatBookChunkForPrompt).join('\n\n')
        : '';

      const system = buildCoachSystemPrompt({
        userContext: ctx.text,
        foodContext,
        bookContext,
        locale,
      });

      reply = await completeChat({ system, messages: llmMessages });
      fastApiMeta = {
        bookTopics: bookChunks.map((b) => b.topic),
        foodContextChars: foodContext.length,
      };
    }

    const savedConversationId = await appendTurn({
      userId: req.user.id,
      conversationId: conversation?._id?.toString() || conversationId,
      locale,
      userMessage: lastUserMsg,
      assistantReply: reply || '',
      meta: { viaFastApi, ...fastApiMeta },
    });

    res.json({
      reply: reply || '',
      conversationId: savedConversationId,
    });
  } catch (err) {
    logger.error({ err }, 'AI chat failed');
    const msg = err.message || '';
    if (msg.includes('not configured')) {
      return res.status(503).json({ error: `AI is not configured. Set ${providerConfigHint()}.` });
    }
    res.status(502).json({ error: 'AI request failed' });
  }
});

module.exports = router;
