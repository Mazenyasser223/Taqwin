/**
 * AI plan endpoints — Postgres official store (Block C2).
 *
 *   GET    /api/ai/plan/me           Active plan (WorkoutPlan + DietPlan)
 *   GET    /api/ai/plan/history      Recent plan versions (Postgres)
 *   GET    /api/ai/plan/jobs/:jobId  BullMQ job status (Block C3, when queue enabled)
 *   POST   /api/ai/plan/regenerate   Generate + validate + persist (or enqueue)
 *   POST   /api/ai/plan/generate     Alias for regenerate
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { authMiddleware } = require('../../middleware/auth');
const { logger } = require('../../lib/logger');
const { generatePlanForUser } = require('../../lib/plans/generator');
const { fetchActivePlan } = require('../../services/activePlanService');
const { fetchPlanHistoryFromPostgres } = require('../../lib/plans/persistPostgres');
const {
  isPlanQueueEnabled,
  enqueuePlanGenerate,
  getPlanGenerateJobStatus,
} = require('../../jobs/planGenerateJobs');

const router = express.Router();
router.use(authMiddleware);

const planLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.AI_PLAN_RATE_LIMIT_MAX || 5),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Plan generation rate limit exceeded. Try again in a minute.' },
});

function plansStorageReady() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

router.get('/me', async (req, res, next) => {
  try {
    if (!plansStorageReady()) {
      return res.status(503).json({
        error: 'Plan storage unavailable',
        detail: 'Set DATABASE_URL (Postgres) for athlete plans.',
      });
    }

    const plan = await fetchActivePlan(req.user.id);
    if (!plan) {
      return res.status(404).json({ error: 'No active plan' });
    }

    res.json({ plan, storage: 'postgres' });
  } catch (err) {
    next(err);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    if (!plansStorageReady()) {
      return res.status(503).json({ error: 'Plan storage unavailable' });
    }

    const plans = await fetchPlanHistoryFromPostgres(req.user.id, 10);
    res.json({ plans, storage: 'postgres' });
  } catch (err) {
    next(err);
  }
});

router.get('/jobs/:jobId', async (req, res, next) => {
  try {
    if (!isPlanQueueEnabled()) {
      return res.status(503).json({
        error: 'Plan queue unavailable',
        detail: 'Set FEATURE_PLAN_QUEUE=true and REDIS_URL (TCP).',
      });
    }
    const status = await getPlanGenerateJobStatus(req.params.jobId, req.user.id);
    if (!status) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({ job: status });
  } catch (err) {
    next(err);
  }
});

function wantsSyncGenerate(req) {
  const q = String(req.query?.sync || '').toLowerCase();
  if (q === '1' || q === 'true') return true;
  return req.body?.sync === true;
}

async function handleGenerate(req, res, next) {
  if (!plansStorageReady()) {
    return res.status(503).json({
      error: 'Plan storage unavailable',
      detail: 'Set DATABASE_URL to enable plan generation.',
    });
  }
  try {
    const locale = req.body?.locale === 'en' ? 'en' : 'ar';
    const reason = String(req.body?.reason || req.body?.regenerationReason || '').slice(0, 120);

    if (isPlanQueueEnabled() && !wantsSyncGenerate(req)) {
      const enq = await enqueuePlanGenerate({
        userId: req.user.id,
        locale,
        regenerationReason: reason,
        source: 'api',
      });

      if (enq.ok) {
        return res.status(202).json({
          status: enq.duplicate ? 'already_queued' : 'queued',
          jobId: enq.jobId,
          state: enq.state,
          poll: `/api/ai/plan/jobs/${enq.jobId}`,
        });
      }

      if (enq.reason === 'locked') {
        return res.status(409).json({
          error: 'Plan generation already in progress',
          jobId: enq.jobId || undefined,
        });
      }

      logger.warn({ userId: req.user.id, reason: enq.reason }, 'plan queue enqueue failed — sync fallback');
    }

    const result = await generatePlanForUser({
      userId: req.user.id,
      locale,
      regenerationReason: reason,
    });
    res.json({
      plan: result.plan,
      source: result.source,
      attempts: result.attempts,
      storage: result.storage || 'postgres',
      validationErrors: result.errors || [],
      mode: 'sync',
    });
  } catch (err) {
    if (err.code === 'PLAN_AI_FAILED') {
      return res.status(502).json({
        error: err.message,
        validationErrors: err.validationErrors || [],
        hint: 'Ensure ai-service :8000 is running with ANTHROPIC_API_KEY; check plan_generation_logs.',
      });
    }
    logger.error({ err, userId: req.user.id }, 'plan generation failed');
    next(err);
  }
}

router.post('/regenerate', planLimiter, handleGenerate);
router.post('/generate', planLimiter, handleGenerate);

module.exports = router;
