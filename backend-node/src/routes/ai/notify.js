/**
 * Block D10 — smart notification preview/trigger for the current athlete.
 *
 *   GET  /api/ai/notify/preview   → candidate reminders (no DB writes)
 *   POST /api/ai/notify/run       → evaluate + emit now (deduped per slot/day)
 */
const express = require('express');
const { logger } = require('../../lib/logger');
const {
  buildSmartNotificationCandidates,
  runSmartNotificationsForUser,
} = require('../../lib/adaptation/smartNotify');

const router = express.Router();

router.get('/preview', async (req, res) => {
  try {
    const result = await buildSmartNotificationCandidates(req.user.id, {});
    res.json({
      ok: result.ok,
      reason: result.reason || null,
      timezone: result.timezone,
      locale: result.locale,
      candidates: (result.candidates || []).map((c) => ({
        kind: c.kind,
        type: c.type,
        title: c.title,
        message: c.message,
        link: c.link,
      })),
    });
  } catch (err) {
    logger.error({ err }, 'GET /api/ai/notify/preview failed');
    res.status(500).json({ error: 'Failed to build notification preview' });
  }
});

router.post('/run', async (req, res) => {
  try {
    const result = await runSmartNotificationsForUser(req.user.id, {});
    res.json({
      ok: result.ok,
      reason: result.reason || null,
      emitted: result.emitted || 0,
      skipped: result.skipped || 0,
    });
  } catch (err) {
    logger.error({ err }, 'POST /api/ai/notify/run failed');
    res.status(500).json({ error: 'Failed to run notifications' });
  }
});

module.exports = router;
