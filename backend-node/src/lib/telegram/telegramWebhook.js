/**
 * Handle incoming Telegram webhook updates (link / unlink / help).
 */
const { logger } = require('../logger');
const { sendTelegramMessage } = require('./telegramClient');
const { linkTelegramByToken, unlinkTelegramByChatId } = require('./telegramLink');

function extractStartPayload(text) {
  if (!text || typeof text !== 'string') return null;
  const parts = text.trim().split(/\s+/);
  if (parts[0] !== '/start' || !parts[1]) return null;
  return parts[1];
}

async function handleTelegramUpdate(update) {
  const message = update?.message;
  if (!message?.chat?.id) return { ok: true, handled: false };

  const chatId = message.chat.id;
  const text = message.text || '';
  const from = message.from || {};

  if (text.startsWith('/start')) {
    const payload = extractStartPayload(text);
    if (payload?.startsWith('LINK_')) {
      const token = payload.slice('LINK_'.length);
      const result = await linkTelegramByToken(token, chatId, from);
      if (result.ok) {
        await sendTelegramMessage(
          chatId,
          '✅ <b>تم ربط حساب Taqwin بنجاح!</b>\n\nستصلك من 0 إلى 3 تنبيهات مهمة يومياً.\nيمكنك تخصيص أنواع التنبيهات من إعدادات التطبيق.\n\n/unlink — إلغاء الربط\n/status — حالة الربط',
        );
        logger.info({ userId: result.userId, chatId }, 'Telegram account linked');
        return { ok: true, handled: true, action: 'linked' };
      }

      const messages = {
        invalid_or_expired_token:
          '❌ رابط الربط منتهي أو غير صالح.\nافتح Taqwin → الإعدادات → Telegram Alerts → "ربط Telegram" للحصول على رابط جديد.',
        chat_already_linked:
          '❌ هذا الحساب Telegram مربوط بمستخدم Taqwin آخر.\nاستخدم /unlink أولاً أو سجّل الدخول بالحساب الصحيح.',
      };
      await sendTelegramMessage(chatId, messages[result.reason] || '❌ تعذّر ربط الحساب. حاول مرة أخرى من التطبيق.');
      return { ok: true, handled: true, action: 'link_failed', reason: result.reason };
    }

    await sendTelegramMessage(
      chatId,
      '🏋️ <b>مرحباً بك في Taqwin AI Fitness Bot</b>\n\nلربط حسابك:\n1. افتح Taqwin → الإعدادات → Telegram Alerts\n2. اضغط "ربط Telegram"\n3. افتح الرابط من التطبيق\n\n/status — حالة الربط\n/unlink — إلغاء الربط',
    );
    return { ok: true, handled: true, action: 'welcome' };
  }

  if (text.startsWith('/unlink')) {
    const result = await unlinkTelegramByChatId(chatId);
    if (result.ok) {
      await sendTelegramMessage(chatId, '✅ تم إلغاء ربط حساب Taqwin. لن تصلك تنبيهات بعد الآن.');
      return { ok: true, handled: true, action: 'unlinked' };
    }
    await sendTelegramMessage(chatId, 'ℹ️ لا يوجد حساب Taqwin مربوط بهذا Telegram.');
    return { ok: true, handled: true, action: 'unlink_none' };
  }

  if (text.startsWith('/status')) {
    const { prisma } = require('../../db');
    const user = await prisma.user.findUnique({
      where: { telegramChatId: String(chatId) },
      select: { telegramLinkedAt: true, email: true },
    });
    if (!user) {
      await sendTelegramMessage(chatId, '❌ غير مربوط. افتح Taqwin → الإعدادات → Telegram Alerts للربط.');
      return { ok: true, handled: true, action: 'status_unlinked' };
    }
    const linkedAt = user.telegramLinkedAt
      ? user.telegramLinkedAt.toISOString().slice(0, 10)
      : 'unknown';
    await sendTelegramMessage(
      chatId,
      `✅ <b>مربوط بـ Taqwin</b>\n\n📧 ${user.email}\n📅 منذ: ${linkedAt}\n\nعدّل التفضيلات من إعدادات التطبيق.`,
    );
    return { ok: true, handled: true, action: 'status_linked' };
  }

  if (text.startsWith('/help')) {
    await sendTelegramMessage(
      chatId,
      '<b>Taqwin Bot Commands</b>\n\n/start — ترحيب وربط الحساب\n/status — حالة الربط\n/unlink — إلغاء الربط\n/help — هذه الرسالة',
    );
    return { ok: true, handled: true, action: 'help' };
  }

  return { ok: true, handled: false };
}

module.exports = { handleTelegramUpdate, extractStartPayload };
