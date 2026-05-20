/**
 * AI proxy — server-side LLM (Ollama / Claude / Gemini). API keys never reach the browser.
 *
 *   POST /api/ai/chat
 *     body: { messages: [{ role: 'user'|'model', content }], locale?: 'en'|'ar' }
 *     Returns: { reply: string }
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
const { completeChat, providerConfigHint } = require('../services/aiChatProvider');

const router = express.Router();
router.use(authMiddleware);

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
  }),
});

router.post('/chat', aiLimiter, validate(chatSchema), async (req, res) => {
  try {
    const { messages, locale: bodyLocale } = req.body;

    const ctx = await buildCoachUserContext(req.user.id);
    const locale = bodyLocale === 'en' || bodyLocale === 'ar' ? bodyLocale : ctx.locale;

    const foodContext = await buildCoachFoodContext({
      profile: ctx.profile,
      onboarding: ctx.onboarding,
      messages,
      lang: locale,
    });

    const system = buildCoachSystemPrompt({
      userContext: ctx.text,
      foodContext,
      locale,
    });

    const reply = await completeChat({ system, messages });
    res.json({ reply: reply || '' });
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
