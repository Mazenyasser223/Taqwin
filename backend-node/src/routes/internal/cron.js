/**
 * Block C10/C11 — internal cron triggers (X-Internal-Key).
 *
 *   POST /api/internal/cron/weekly-adapt
 *   POST /api/internal/cron/daily-refresh
 *   POST /api/internal/cron/mid-week
 *   POST /api/internal/cron/memory-summarize
 *   POST /api/internal/cron/smart-notify
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
const { logger } = require('../../lib/logger');

const router = express.Router();
router.use(internalAuthMiddleware);

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
    logger.error({ err }, 'POST /internal/cron/weekly-adapt failed');
    res.status(500).json({ error: err.message });
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
    logger.error({ err }, 'POST /internal/cron/daily-refresh failed');
    res.status(500).json({ error: err.message });
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
    logger.error({ err }, 'POST /internal/cron/mid-week failed');
    res.status(500).json({ error: err.message });
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
    logger.error({ err }, 'POST /internal/cron/memory-summarize failed');
    res.status(500).json({ error: err.message });
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
    logger.error({ err }, 'POST /internal/cron/smart-notify failed');
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
