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
const { prisma } = require('../db');
const {
  generateAndPersistCoachPlan,
  getCoachPlanFromOnboarding,
  applyCoachPlanPatch,
  coachPlanMeta,
  exerciseSchema,
} = require('../lib/coachPlan');

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

const planGenerateSchema = z.object({
  body: z.object({
    locale: z.enum(['en', 'ar']).optional(),
    force: z.boolean().optional(),
  }),
});

const planPatchSchema = z.object({
  body: z.object({
    locale: z.enum(['en', 'ar']).optional(),
    workoutDayOverride: z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        exercises: z.array(exerciseSchema).max(30),
      })
      .optional(),
    dietDayOverride: z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        slots: z.array(z.record(z.unknown())).max(12),
      })
      .optional(),
    dietSlots: z.array(z.record(z.unknown())).max(12).optional(),
    aiSummary: z.string().max(2000).optional().nullable(),
  }),
});

router.post('/plan/generate', aiLimiter, validate(planGenerateSchema), async (req, res, next) => {
  try {
    const locale = req.body.locale === 'en' ? 'en' : 'ar';
    const plan = await generateAndPersistCoachPlan(prisma, req.user.id, locale, {
      force: Boolean(req.body.force),
    });
    res.status(201).json({ plan, meta: coachPlanMeta(plan) });
  } catch (err) {
    logger.error({ err }, 'Coach plan generate failed');
    next(err);
  }
});

router.get('/plan/me', async (req, res, next) => {
  try {
    const profile = await prisma.profile.findUnique({ where: { userId: req.user.id } });
    const plan = getCoachPlanFromOnboarding(profile?.onboardingData);
    res.json({ plan, meta: coachPlanMeta(plan) });
  } catch (err) {
    next(err);
  }
});

router.patch('/plan', validate(planPatchSchema), async (req, res, next) => {
  try {
    const plan = await applyCoachPlanPatch(prisma, req.user.id, req.body);
    res.json({ plan, meta: coachPlanMeta(plan) });
  } catch (err) {
    if (err.message === 'Invalid coach plan patch') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/plan/regenerate', aiLimiter, validate(planGenerateSchema), async (req, res, next) => {
  try {
    const locale = req.body.locale === 'en' ? 'en' : 'ar';
    const profile = await prisma.profile.findUnique({ where: { userId: req.user.id } });
    const od =
      profile?.onboardingData && typeof profile.onboardingData === 'object'
        ? { ...profile.onboardingData, coachPlanForceRegenerate: true }
        : { coachPlanForceRegenerate: true };
    await prisma.profile.update({
      where: { userId: req.user.id },
      data: { onboardingData: od },
    });
    const plan = await generateAndPersistCoachPlan(prisma, req.user.id, locale, { force: true });
    res.json({ plan, meta: coachPlanMeta(plan) });
  } catch (err) {
    logger.error({ err }, 'Coach plan regenerate failed');
    next(err);
  }
});

module.exports = router;
