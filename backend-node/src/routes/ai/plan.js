/**
 * AI plan endpoints — MongoDB-backed.
 *
 *   GET    /api/ai/plan/me           Active plan for current user (or 404)
 *   POST   /api/ai/plan/regenerate   Trigger AI plan generation
 *   POST   /api/ai/plan/generate     Alias for regenerate (called after onboarding)
 *
 * Phase 2 ships GET + a stubbed regenerate that returns 501 until Phase 5
 * wires the LLM + validator. Mounted under the existing /api/ai prefix.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { authMiddleware } = require('../../middleware/auth');
const { logger } = require('../../lib/logger');
const { connectMongo, isMongoConfigured } = require('../../db/mongo/client');
const { generatePlanForUser } = require('../../lib/plans/generator');

const router = express.Router();
router.use(authMiddleware);

const planLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.AI_PLAN_RATE_LIMIT_MAX || 5),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Plan generation rate limit exceeded. Try again in a minute.' },
});

async function loadPlanModel() {
  if (!isMongoConfigured()) return null;
  const conn = await connectMongo();
  if (!conn) return null;
  return require('../../db/mongo/models/plan');
}

router.get('/me', async (req, res, next) => {
  try {
    const Plan = await loadPlanModel();
    if (!Plan) {
      return res.status(503).json({
        error: 'Plan storage unavailable',
        detail: 'Set MONGO_URI in .env to enable saved plans.',
      });
    }

    const plan = await Plan.findOne({ userId: req.user.id, isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    if (!plan) {
      return res.status(404).json({ error: 'No active plan' });
    }

    res.json({ plan });
  } catch (err) {
    next(err);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const Plan = await loadPlanModel();
    if (!Plan) return res.status(503).json({ error: 'Plan storage unavailable' });

    const plans = await Plan.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('-inputSnapshot')
      .lean();

    res.json({ plans });
  } catch (err) {
    next(err);
  }
});

async function handleGenerate(req, res, next) {
  if (!isMongoConfigured()) {
    return res.status(503).json({ error: 'Set MONGO_URI to enable plan generation.' });
  }
  try {
    const locale = req.body?.locale === 'en' ? 'en' : 'ar';
    const reason = String(req.body?.reason || '').slice(0, 120);
    const result = await generatePlanForUser({
      userId: req.user.id,
      locale,
      regenerationReason: reason,
    });
    res.json({
      plan: result.plan,
      source: result.source,
      attempts: result.attempts,
      validationErrors: result.errors || [],
    });
  } catch (err) {
    logger.error({ err, userId: req.user.id }, 'plan generation failed');
    next(err);
  }
}

router.post('/regenerate', planLimiter, handleGenerate);
router.post('/generate', planLimiter, handleGenerate);

module.exports = router;
