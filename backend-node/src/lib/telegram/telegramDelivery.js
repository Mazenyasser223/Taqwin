/**
 * Deliver in-app notifications to linked Telegram accounts.
 * Gated only by user Telegram prefs + blocked types (no daily cap).
 * Failures are logged + counted — never throw (in-app notification stays intact).
 */
const { prisma } = require('../../db');
const { logger } = require('../logger');
const { getFrontendUrl } = require('../frontendUrl');
const { inc } = require('../notifications/notificationMetrics');
const { isBlockedType, shouldNotifyUser } = require('./telegramTypeMap');
const { renderNotification } = require('../notifications/notificationTemplates');
const { sendTelegramMessage, buildOpenAppKeyboard, isTelegramConfigured, isTelegramSafeUrl } = require('./telegramClient');

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildAppLink(row) {
  const base = getTelegramAppBaseUrl();
  const path = row.link || '/dashboard';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Public HTTPS origin for Telegram deep links (localhost is rejected by Telegram). */
function getTelegramAppBaseUrl() {
  const candidates = [
    process.env.TELEGRAM_APP_URL,
    getFrontendUrl(),
    'https://taqwin.online',
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const base = String(raw).split(',')[0].trim().replace(/\/$/, '');
    if (isTelegramSafeUrl(base)) return base;
  }
  return 'https://taqwin.online';
}

function resolveNotificationLang(settings) {
  return settings?.language === 'ar' ? 'ar' : 'en';
}

function resolveTelegramCopy(row, lang) {
  if (!row?.type) {
    return { title: row?.title || '', message: row?.message || '' };
  }
  const payload =
    row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) ? row.payload : {};
  const rendered = renderNotification(row.type, payload, lang);
  return {
    title: rendered.title || row.title || '',
    message: rendered.message || row.message || '',
  };
}

function formatTelegramHtml(row, lang = 'en') {
  const copy = resolveTelegramCopy(row, lang);
  const title = escapeHtml(copy.title);
  const message = escapeHtml(copy.message);
  const divider = '<i>━━━━━━━━━━━━━━━━━━━━━━</i>';
  return `<b>${title}</b>\n${divider}\n\n${message}`;
}

async function loadTelegramContext(userId) {
  const [user, settings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { telegramChatId: true, telegramLinkedAt: true },
    }),
    prisma.userSettings.findUnique({ where: { userId } }),
  ]);
  return { user, settings };
}

/**
 * Decide whether this notification should be sent to Telegram.
 */
function shouldSendTelegram(row, settings) {
  return shouldNotifyUser(row?.type, settings);
}

/**
 * Send notification to user's linked Telegram chat.
 * Never throws — API/DB errors are logged and counted only.
 * @param {object} [deps] — test hooks (loadTelegramContext, sendMessage)
 */
async function maybeSendTelegram(userId, row, deps = {}) {
  if (!isTelegramConfigured() || !row) return { ok: false, skipped: true, reason: 'not_configured' };

  const loadCtx = deps.loadTelegramContext || loadTelegramContext;
  const sendMessage = deps.sendTelegramMessage || sendTelegramMessage;

  try {
    const { user, settings } = await loadCtx(userId);
    if (!user?.telegramChatId) return { ok: false, skipped: true, reason: 'not_linked' };
    if (!shouldSendTelegram(row, settings)) {
      return { ok: false, skipped: true, reason: isBlockedType(row.type) ? 'blocked_type' : 'prefs' };
    }

    const lang = resolveNotificationLang(settings);
    const text = formatTelegramHtml(row, lang);
    const link = buildAppLink(row);
    const result = await sendMessage(user.telegramChatId, text, {
      replyMarkup: buildOpenAppKeyboard(link, lang),
    });

    if (result.ok) {
      inc('telegramSentToday');
      return { ok: true, sent: true };
    }

    inc('telegramFailedToday');
    logger.warn(
      {
        userId,
        type: row.type,
        notificationId: row.id,
        error: result.description || result.error,
      },
      'Telegram API delivery failed (in-app notification unaffected)',
    );
    return { ok: false, sent: false, reason: 'api_error', error: result.description || result.error };
  } catch (err) {
    inc('telegramFailedToday');
    logger.warn(
      { err: err?.message, userId, type: row?.type, notificationId: row?.id },
      'Telegram delivery error (in-app notification unaffected)',
    );
    return { ok: false, sent: false, reason: 'exception', error: err?.message };
  }
}

module.exports = {
  shouldSendTelegram,
  maybeSendTelegram,
  formatTelegramHtml,
  resolveTelegramCopy,
  resolveNotificationLang,
  buildAppLink,
  getTelegramAppBaseUrl,
};
