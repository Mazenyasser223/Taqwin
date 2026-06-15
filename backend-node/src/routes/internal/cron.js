/**
 * Block C10/C11 — internal cron triggers (X-Internal-Key).
 *
 *   POST /api/internal/cron/weekly-adapt
 *   POST /api/internal/cron/daily-refresh
 *   POST /api/internal/cron/mid-week
 *   POST /api/internal/cron/memory-summarize
 *   POST /api/internal/cron/smart-notify
 *   POST /api/internal/cron/cancel-pending-orders
 *   POST /api/internal/cron/reorder-reminders
 *   POST /api/internal/cron/subscription-due
 */
const express = require('express');
const { z } = require('zod');
const { internalAuthMiddleware } = require('../../middleware/internalAuth');
const { validate } = require('../../middleware/validate');
const { runWeeklyAdaptBatch } = require('../../lib/adaptation/weeklyAdaptBatch');
const { runDailyRefreshBatch } = require('../../lib/plans/dailyRefreshBatch');
const { runMidWeekBatch } = require('../../lib/adaptation/midWeekBatch');
const { runMemorySummarizeBatch } = require('../../lib/ai/memorySummarizeBatch');
const { runSmartNotifyBatch } = require('../../lib/adaptation/smartNotifyBatch');
const { cancelExpiredPendingOrders } = require('../../lib/pendingOrderExpiry');
const { runReorderReminderBatch } = require('../../lib/commerce/reorderEngine');
const { runSubscriptionDueBatch } = require('../../lib/commerce/productSubscriptions');
const { logger } = require('../../lib/logger');
const { captureCronFailure } = require('../../lib/sentry');

const router = express.Router();
router.use(internalAuthMiddleware);

function handleCronError(res, jobName, err) {
  logger.error({ err }, `POST /internal/cron/${jobName} failed`);
  captureCronFailure(jobName, err, { route: `/api/internal/cron/${jobName}` });
  res.status(500).json({ error: err.message });
}

const weeklyAdaptSchema = z.object({
  body: z
    .object({
      dryRun: z.boolean().optional(),
      respectTimezoneWindow: z.boolean().optional(),
      precomputeMetrics: z.boolean().optional(),
    })
    .optional()
    .default({}),
});

router.post('/weekly-adapt', validate(weeklyAdaptSchema), async (req, res) => {
  try {
    const body = req.body || {};
    const result = await runWeeklyAdaptBatch({
      dryRun: Boolean(body.dryRun),
      respectTimezoneWindow: body.respectTimezoneWindow !== false,
      precomputeMetrics: body.precomputeMetrics !== false,
    });
    res.json({ ok: result.ok !== false, result });
  } catch (err) {
    handleCronError(res, 'weekly-adapt', err);
  }
});

const dailyRefreshSchema = z.object({
  body: z
    .object({
      dryRun: z.boolean().optional(),
      respectTimezoneWindow: z.boolean().optional(),
      days: z.coerce.number().int().min(1).max(14).optional(),
    })
    .optional()
    .default({}),
});

router.post('/daily-refresh', validate(dailyRefreshSchema), async (req, res) => {
  try {
    const body = req.body || {};
    const result = await runDailyRefreshBatch({
      dryRun: Boolean(body.dryRun),
      respectTimezoneWindow: body.respectTimezoneWindow !== false,
      days: body.days,
    });
    res.json({ ok: result.ok !== false, result });
  } catch (err) {
    handleCronError(res, 'daily-refresh', err);
  }
});

const midWeekSchema = z.object({
  body: z
    .object({
      dryRun: z.boolean().optional(),
      respectTimezoneWindow: z.boolean().optional(),
    })
    .optional()
    .default({}),
});

router.post('/mid-week', validate(midWeekSchema), async (req, res) => {
  try {
    const body = req.body || {};
    const result = await runMidWeekBatch({
      dryRun: Boolean(body.dryRun),
      respectTimezoneWindow: body.respectTimezoneWindow !== false,
    });
    res.json({ ok: result.ok !== false, result });
  } catch (err) {
    handleCronError(res, 'mid-week', err);
  }
});

router.post('/memory-summarize', validate(midWeekSchema), async (req, res) => {
  try {
    const body = req.body || {};
    const result = await runMemorySummarizeBatch({
      dryRun: Boolean(body.dryRun),
      respectTimezoneWindow: body.respectTimezoneWindow !== false,
    });
    res.json({ ok: result.ok !== false, result });
  } catch (err) {
    handleCronError(res, 'memory-summarize', err);
  }
});

const smartNotifySchema = z.object({
  body: z
    .object({
      dryRun: z.boolean().optional(),
      limit: z.coerce.number().int().min(1).max(5000).optional(),
    })
    .optional()
    .default({}),
});

router.post('/smart-notify', validate(smartNotifySchema), async (req, res) => {
  try {
    const body = req.body || {};
    const result = await runSmartNotifyBatch({
      dryRun: Boolean(body.dryRun),
      limit: body.limit,
    });
    res.json({ ok: result.ok !== false, result });
  } catch (err) {
    handleCronError(res, 'smart-notify', err);
  }
});

const pendingOrdersSchema = z.object({
  body: z
    .object({
      maxAgeMs: z.coerce.number().int().min(60_000).max(7 * 24 * 60 * 60 * 1000).optional(),
    })
    .optional()
    .default({}),
});

router.post('/cancel-pending-orders', validate(pendingOrdersSchema), async (req, res) => {
  try {
    const body = req.body || {};
    const result = await cancelExpiredPendingOrders(body.maxAgeMs);
    res.json({ ok: true, result });
  } catch (err) {
    handleCronError(res, 'cancel-pending-orders', err);
  }
});

router.post('/reorder-reminders', validate(smartNotifySchema), async (req, res) => {
  try {
    const body = req.body || {};
    const result = await runReorderReminderBatch({
      dryRun: Boolean(body.dryRun),
      limit: body.limit,
    });
    res.json({ ok: true, result });
  } catch (err) {
    handleCronError(res, 'reorder-reminders', err);
  }
});

router.post('/subscription-due', validate(smartNotifySchema), async (req, res) => {
  try {
    const body = req.body || {};
    const result = await runSubscriptionDueBatch({
      dryRun: Boolean(body.dryRun),
      limit: body.limit,
    });
    res.json({ ok: true, result });
  } catch (err) {
    handleCronError(res, 'subscription-due', err);
  }
});

module.exports = router;
