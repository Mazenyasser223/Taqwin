/**
 * AI proxy — server-side LLM (Ollama / Claude / Gemini). API keys never reach the browser.
 *
 *   POST /api/ai/chat
 *     body: { messages: [{ role: 'user'|'model', content }], locale?: 'en'|'ar' }
 *     Returns: { reply: string }
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
const { checkOffTopic } = require('../lib/coach/offTopicGuard');
const { isMongoConfigured, connectMongo } = require('../db/mongo/client');
const planRoutes = require('./ai/plan');
const conversationsRoutes = require('./ai/conversations');

const router = express.Router();
router.use(authMiddleware);
router.use('/plan', planRoutes);
router.use('/conversations', conversationsRoutes);

async function loadChatMemoryModels() {
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
  }),
});

router.post('/chat', aiLimiter, validate(chatSchema), async (req, res) => {
  try {
    const { messages, locale: bodyLocale, conversationId } = req.body;

    const ctx = await buildCoachUserContext(req.user.id);
    const locale = bodyLocale === 'en' || bodyLocale === 'ar' ? bodyLocale : ctx.locale;

    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

    // Off-topic guard: short-circuit unrelated requests with a fixed reply.
    const guardResult = await checkOffTopic(lastUserMsg, { locale }).catch(() => ({
      inDomain: true,
      reason: 'guard-error',
    }));
    if (!guardResult.inDomain && guardResult.offTopicReply) {
      const reply = guardResult.offTopicReply;
      await persistTurn({
        userId: req.user.id,
        conversationId,
        locale,
        userMessage: lastUserMsg,
        assistantReply: reply,
        meta: { offTopic: true, reason: guardResult.reason },
      }).catch(() => null);
      return res.json({ reply, offTopic: true });
    }

    // Memory: prepend stored history when a conversationId is provided.
    const { historyMessages, conversation } = await resolveHistory({
      userId: req.user.id,
      conversationId,
      locale,
    });

    const foodContext = await buildCoachFoodContext({
      profile: ctx.profile,
      onboarding: ctx.onboarding,
      messages,
      lang: locale,
    });

    const bookChunks = await retrieveBookChunks({
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

    const llmMessages = [...historyMessages, ...messages].slice(-30);
    const reply = await completeChat({ system, messages: llmMessages });

    const savedConversationId = await persistTurn({
      userId: req.user.id,
      conversationId: conversation?._id?.toString() || conversationId,
      locale,
      userMessage: lastUserMsg,
      assistantReply: reply || '',
      meta: {
        bookTopics: bookChunks.map((b) => b.topic),
        foodContextChars: foodContext.length,
      },
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

const HISTORY_TAKE = 12;

async function resolveHistory({ userId, conversationId, locale }) {
  const models = await loadChatMemoryModels();
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

  const recent = await models.Message.find({ conversationId: conversation._id })
    .sort({ createdAt: -1 })
    .limit(HISTORY_TAKE)
    .lean();
  const historyMessages = recent
    .reverse()
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', content: m.content }));

  void locale;
  return { historyMessages, conversation };
}

async function persistTurn({ userId, conversationId, locale, userMessage, assistantReply, meta = {} }) {
  const models = await loadChatMemoryModels();
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

  return convDoc._id.toString();
}

module.exports = router;
