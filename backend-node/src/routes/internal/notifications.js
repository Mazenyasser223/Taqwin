/**
 * Internal notification ops — health & diagnostics (X-Internal-Key).
 *
 *   GET /api/internal/notifications/health
 */
const express = require('express');
const { internalAuthMiddleware } = require('../../middleware/internalAuth');
const { getNotificationHealth } = require('../../lib/notifications/notificationHealth');
const { flushMetrics } = require('../../lib/notifications/notificationMetrics');
const { logger } = require('../../lib/logger');

const router = express.Router();
router.use(internalAuthMiddleware);

router.get('/health', async (req, res, next) => {
  try {
    const report = await getNotificationHealth();
    flushMetrics('health_probe');
    logger.info({ notificationHealth: report.metrics, queues: report.queues }, 'notification health probe');
    res.json(report);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
