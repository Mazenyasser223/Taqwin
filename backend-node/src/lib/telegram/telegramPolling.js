/**
 * Dev fallback — long-poll Telegram updates when no public webhook URL is available.
 */
const { logger } = require('../logger');
const { isTelegramConfigured, telegramRequest } = require('./telegramClient');
const { handleTelegramUpdate } = require('./telegramWebhook');

let offset = 0;
let timer = null;
let running = false;

async function pollOnce() {
  if (!running) return;
  try {
    const data = await telegramRequest('getUpdates', {
      offset,
      timeout: 25,
      allowed_updates: ['message'],
    });
    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        offset = update.update_id + 1;
        await handleTelegramUpdate(update);
      }
    }
  } catch (err) {
    logger.warn({ err: err?.message }, 'Telegram polling error');
  }
  if (running) {
    timer = setTimeout(pollOnce, 500);
  }
}

function startTelegramPolling() {
  if (running || !isTelegramConfigured()) return false;
  const enabled =
    (process.env.TELEGRAM_POLLING || '').toLowerCase() === 'true' ||
    (process.env.NODE_ENV !== 'production' && !process.env.TELEGRAM_WEBHOOK_URL && !process.env.BACKEND_PUBLIC_URL);
  if (!enabled) return false;

  running = true;
  const { deleteTelegramWebhook } = require('./telegramClient');
  void deleteTelegramWebhook().then(() => {
    logger.info('Telegram long-polling started (dev mode — set TELEGRAM_WEBHOOK_URL for production webhook)');
    void pollOnce();
  });
  return true;
}

function stopTelegramPolling() {
  running = false;
  if (timer) clearTimeout(timer);
  timer = null;
}

module.exports = { startTelegramPolling, stopTelegramPolling };
