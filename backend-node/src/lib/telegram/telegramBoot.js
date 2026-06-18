/**
 * Register Telegram webhook on server boot (production / when public URL is set).
 */
const { logger } = require('./logger');
const {
  isTelegramConfigured,
  setTelegramWebhook,
  getTelegramWebhookInfo,
} = require('./telegram/telegramClient');

function getWebhookUrl() {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return null;

  const base =
    process.env.TELEGRAM_WEBHOOK_URL ||
    process.env.BACKEND_PUBLIC_URL ||
    process.env.API_PUBLIC_URL ||
    '';

  if (!base) return null;
  const trimmed = base.replace(/\/$/, '');
  return `${trimmed}/api/telegram/webhook/${secret}`;
}

async function ensureTelegramWebhook() {
  if (!isTelegramConfigured()) {
    logger.info('Telegram bot token not set — skipping webhook registration');
    return { ok: false, reason: 'not_configured' };
  }

  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    logger.info('TELEGRAM_WEBHOOK_URL / BACKEND_PUBLIC_URL not set — webhook not registered (use polling in dev or set URL)');
    return { ok: false, reason: 'no_webhook_url' };
  }

  try {
    const result = await setTelegramWebhook(webhookUrl);
    if (result.ok) {
      logger.info({ webhookUrl }, 'Telegram webhook registered');
    } else {
      logger.warn({ error: result.description, webhookUrl }, 'Telegram webhook registration failed');
    }
    return result;
  } catch (err) {
    logger.warn({ err: err?.message }, 'Telegram webhook registration error');
    return { ok: false, error: err?.message };
  }
}

module.exports = { ensureTelegramWebhook, getWebhookUrl, getTelegramWebhookInfo };
