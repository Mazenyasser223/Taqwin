/**
 * Block C10/C11 — internal cron triggers (X-Internal-Key).
 *
 *   POST /api/internal/cron/weekly-adapt
 *   POST /api/internal/cron/daily-refresh
 */
const express = require('express');
const { z } = require('zod');
const { internalAuthMiddleware } = require('../../middleware/internalAuth');
const { validate } = require('../../middleware/validate');
const { runWeeklyAdaptBatch } = require('../../lib/adaptation/weeklyAdaptBatch');
const { runDailyRefreshBatch } = require('../../lib/plans/dailyRefreshBatch');
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

module.exports = router;
