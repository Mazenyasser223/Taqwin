/**
 * Telegram Bot API webhook (public, secret in URL path).
 *
 *   POST /api/telegram/webhook/:secret
 */
const express = require('express');
const { logger } = require('../lib/logger');
const { handleTelegramUpdate } = require('../lib/telegram/telegramWebhook');
const { isTelegramConfigured } = require('../lib/telegram/telegramClient');

const router = express.Router();

router.post('/webhook/:secret', async (req, res) => {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET || '';
  if (!expected || req.params.secret !== expected) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!isTelegramConfigured()) {
    return res.status(503).json({ error: 'Telegram not configured' });
  }

  try {
    const result = await handleTelegramUpdate(req.body);
    res.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err: err?.message }, 'Telegram webhook handler failed');
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

module.exports = router;
