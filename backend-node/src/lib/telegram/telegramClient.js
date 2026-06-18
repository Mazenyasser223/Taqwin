/**
 * Telegram Bot API client — send messages and manage webhook.
 */
const { logger } = require('../logger');

const API_BASE = 'https://api.telegram.org/bot';

function getBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN || '';
}

function getBotUsername() {
  return process.env.TELEGRAM_BOT_USERNAME || 'Taqwin_Ai_Fitness_bot';
}

function isTelegramConfigured() {
  return Boolean(getBotToken());
}

async function telegramRequest(method, body = {}) {
  const token = getBotToken();
  if (!token) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' };
  }

  const res = await fetch(`${API_BASE}${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    logger.warn({ method, error: data.description, status: res.status }, 'Telegram API error');
  }
  return data;
}

async function sendTelegramMessage(chatId, text, opts = {}) {
  if (!chatId || !text) return { ok: false, error: 'missing chatId or text' };

  return telegramRequest('sendMessage', {
    chat_id: chatId,
    text: text.slice(0, 4096),
    parse_mode: opts.parseMode || 'HTML',
    disable_web_page_preview: opts.disablePreview !== false,
    reply_markup: opts.replyMarkup || undefined,
  });
}

function buildOpenAppKeyboard(link) {
  if (!link) return undefined;
  return {
    inline_keyboard: [[{ text: 'Open Taqwin', url: link }]],
  };
}

async function setTelegramWebhook(webhookUrl) {
  if (!webhookUrl) return { ok: false, error: 'missing webhook URL' };
  return telegramRequest('setWebhook', {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: false,
  });
}

async function deleteTelegramWebhook() {
  return telegramRequest('deleteWebhook', { drop_pending_updates: false });
}

async function getTelegramWebhookInfo() {
  return telegramRequest('getWebhookInfo', {});
}

module.exports = {
  getBotToken,
  getBotUsername,
  isTelegramConfigured,
  sendTelegramMessage,
  buildOpenAppKeyboard,
  setTelegramWebhook,
  deleteTelegramWebhook,
  getTelegramWebhookInfo,
  telegramRequest,
};
