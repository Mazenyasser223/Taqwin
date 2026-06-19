/**
 * Deliver in-app notifications to linked Telegram accounts (0–3/day cap).
 * Failures are logged + counted — never throw (in-app notification stays intact).
 */
const { prisma } = require('../../db');
const { logger } = require('../logger');
const { getFrontendUrl } = require('../frontendUrl');
const { dayWindowKey } = require('../notifications/notificationEmitCounter');
const { inc } = require('../notifications/notificationMetrics');
const { isBlockedType, isCriticalType, isAllowedByPrefs } = require('./telegramTypeMap');
const { sendTelegramMessage, buildOpenAppKeyboard, isTelegramConfigured } = require('./telegramClient');

const TELEGRAM_DAILY_TYPE = 'telegram.delivery';
const DEFAULT_DAILY_CAP = 3;

function dailyCap() {
  const n = Number(process.env.TELEGRAM_DAILY_CAP);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_CAP;
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildAppLink(row) {
  const base = getFrontendUrl();
  const path = row.link || '/dashboard';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function formatTelegramHtml(row) {
  const title = escapeHtml(row.title);
  const message = escapeHtml(row.message);
  const link = buildAppLink(row);
  return `<b>${title}</b>\n\n${message}\n\n<a href="${escapeHtml(link)}">Open Taqwin</a>`;
}

async function readDailyCount(userId, now = new Date()) {
  const windowKey = dayWindowKey(now);
  const row = await prisma.notificationEmitCounter.findUnique({
    where: { userId_type_windowKey: { userId, type: TELEGRAM_DAILY_TYPE, windowKey } },
  });
  return row?.count || 0;
}

async function incrementDailyCount(userId, now = new Date()) {
  const windowKey = dayWindowKey(now);
  await prisma.notificationEmitCounter.upsert({
    where: { userId_type_windowKey: { userId, type: TELEGRAM_DAILY_TYPE, windowKey } },
    create: { userId, type: TELEGRAM_DAILY_TYPE, windowKey, count: 1 },
    update: { count: { increment: 1 } },
  });
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
  if (!row?.type || !settings) return false;
  if (!settings.telegramEnabled) return false;
  if (isBlockedType(row.type)) return false;
  if (!isAllowedByPrefs(row.type, settings)) return false;
  return true;
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
  const readCount = deps.readDailyCount || readDailyCount;

  try {
    const { user, settings } = await loadCtx(userId);
    if (!user?.telegramChatId) return { ok: false, skipped: true, reason: 'not_linked' };
    if (!shouldSendTelegram(row, settings)) {
      return { ok: false, skipped: true, reason: isBlockedType(row.type) ? 'blocked_type' : 'prefs' };
    }

    const critical = isCriticalType(row.type, row);
    if (!critical) {
      const count = await readCount(userId);
      if (count >= dailyCap()) {
        inc('telegramRateLimitedToday');
        logger.info({ userId, type: row.type, cap: dailyCap() }, 'Telegram daily cap reached');
        return { ok: false, skipped: true, reason: 'rate_limited' };
      }
    }

    const text = formatTelegramHtml(row);
    const link = buildAppLink(row);
    const result = await sendMessage(user.telegramChatId, text, {
      replyMarkup: buildOpenAppKeyboard(link),
    });

    if (result.ok) {
      inc('telegramSentToday');
      if (!critical) await incrementDailyCount(userId);
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
  buildAppLink,
  dailyCap,
  readDailyCount,
};
