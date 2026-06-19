/**
 * Handle incoming Telegram webhook updates (link / unlink / help).
 * Unlinked chats only get onboarding copy — no bot commands until linked via app deep link.
 */
const { logger } = require('../logger');
const { prisma } = require('../../db');
const { sendTelegramMessage } = require('./telegramClient');
const { linkTelegramByToken, unlinkTelegramByChatId } = require('./telegramLink');

const COPY = {
  welcome: {
    ar:
      '👋 أهلاً بك في <b>Taqwin</b>.\n\n' +
      'هذا البوت مخصص لمستخدمي Taqwin فقط.\n\n' +
      '<b>لربط حسابك:</b>\n' +
      '1. سجّل دخول إلى Taqwin\n' +
      '2. Settings → Telegram Alerts\n' +
      '3. اضغط <b>Connect Telegram</b>\n\n' +
      'ثم افتح الرابط من التطبيق — سيتم ربط حسابك تلقائياً.',
    en:
      '👋 Welcome to <b>Taqwin</b>.\n\n' +
      'This bot is for Taqwin members only.\n\n' +
      '<b>To link your account:</b>\n' +
      '1. Sign in to Taqwin\n' +
      '2. Settings → Telegram Alerts\n' +
      '3. Tap <b>Connect Telegram</b>\n\n' +
      'Then open the link from the app — your account will link automatically.',
  },
  linkSuccess: {
    ar:
      '✅ <b>تم ربط حساب Taqwin بنجاح!</b>\n\n' +
      'ستصلك التنبيهات التي تفعّلها من إعدادات التطبيق.\n\n' +
      '/status — حالة الربط\n/unlink — إلغاء الربط',
    en:
      '✅ <b>Taqwin account linked!</b>\n\n' +
      'You will receive alerts enabled in app settings.\n\n' +
      '/status — link status\n/unlink — disconnect',
  },
  linkFailed: {
    invalid_or_expired_token: {
      ar: '❌ رابط الربط منتهي أو غير صالح.\nافتح Taqwin → Settings → Telegram Alerts → Connect Telegram للحصول على رابط جديد.',
      en: '❌ Link expired or invalid.\nOpen Taqwin → Settings → Telegram Alerts → Connect Telegram for a new link.',
    },
    chat_already_linked: {
      ar: '❌ هذا الحساب Telegram مربوط بمستخدم Taqwin آخر.\nاستخدم /unlink من الحساب المربوط أو سجّل الدخول بالحساب الصحيح.',
      en: '❌ This Telegram account is linked to another Taqwin user.\nUse /unlink from the linked account or sign in with the correct one.',
    },
    default: {
      ar: '❌ تعذّر ربط الحساب. حاول مرة أخرى من التطبيق.',
      en: '❌ Could not link your account. Try again from the app.',
    },
  },
  alreadyLinked: {
    ar: (email, date) =>
      `✅ <b>حسابك مربوط بالفعل</b>\n\n📧 ${email}\n📅 منذ: ${date}\n\nعدّل التفضيلات من إعدادات التطبيق.`,
    en: (email, date) =>
      `✅ <b>Already linked</b>\n\n📧 ${email}\n📅 Since: ${date}\n\nManage alert preferences in app settings.`,
  },
  unlinked: {
    ar: 'ℹ️ حسابك غير مربوط بعد.\n\n' + 'افتح Taqwin → Settings → Telegram Alerts → Connect Telegram.',
    en: 'ℹ️ Your account is not linked yet.\n\n' + 'Open Taqwin → Settings → Telegram Alerts → Connect Telegram.',
  },
  unlinkedDone: {
    ar: '✅ تم إلغاء ربط حساب Taqwin. لن تصلك تنبيهات بعد الآن.',
    en: '✅ Taqwin account unlinked. You will no longer receive alerts here.',
  },
  help: {
    ar: '<b>أوامر Taqwin Bot</b>\n\n/start — ترحيب\n/status — حالة الربط\n/unlink — إلغاء الربط\n/help — هذه الرسالة',
    en: '<b>Taqwin Bot commands</b>\n\n/start — welcome\n/status — link status\n/unlink — disconnect\n/help — this message',
  },
};

function extractStartPayload(text) {
  if (!text || typeof text !== 'string') return null;
  const parts = text.trim().split(/\s+/);
  if (parts[0] !== '/start' || !parts[1]) return null;
  return parts[1];
}

function botLang(from = {}) {
  const code = String(from.language_code || '').toLowerCase();
  return code.startsWith('ar') ? 'ar' : 'en';
}

function pickCopy(block, lang, key) {
  if (key && block[key]) return block[key][lang] || block[key].en;
  return block[lang] || block.en;
}

async function findLinkedUser(chatId) {
  return prisma.user.findUnique({
    where: { telegramChatId: String(chatId) },
    select: { id: true, email: true, telegramLinkedAt: true },
  });
}

async function sendWelcome(chatId, lang) {
  await sendTelegramMessage(chatId, pickCopy(COPY.welcome, lang));
}

async function handleTelegramUpdate(update) {
  const message = update?.message;
  if (!message?.chat?.id) return { ok: true, handled: false };

  const chatId = message.chat.id;
  const text = message.text || '';
  const from = message.from || {};
  const lang = botLang(from);

  if (text.startsWith('/start')) {
    const payload = extractStartPayload(text);
    if (payload?.startsWith('LINK_')) {
      const token = payload.slice('LINK_'.length);
      const result = await linkTelegramByToken(token, chatId, from);
      if (result.ok) {
        await sendTelegramMessage(chatId, pickCopy(COPY.linkSuccess, lang));
        logger.info({ userId: result.userId, chatId }, 'Telegram account linked');
        return { ok: true, handled: true, action: 'linked' };
      }

      const failBlock = COPY.linkFailed[result.reason] || COPY.linkFailed.default;
      await sendTelegramMessage(chatId, pickCopy(failBlock, lang));
      return { ok: true, handled: true, action: 'link_failed', reason: result.reason };
    }

    const linked = await findLinkedUser(chatId);
    if (linked) {
      const date = linked.telegramLinkedAt
        ? linked.telegramLinkedAt.toISOString().slice(0, 10)
        : '—';
      await sendTelegramMessage(chatId, COPY.alreadyLinked[lang](linked.email, date));
      return { ok: true, handled: true, action: 'already_linked' };
    }

    await sendWelcome(chatId, lang);
    return { ok: true, handled: true, action: 'welcome' };
  }

  const linked = await findLinkedUser(chatId);
  if (!linked) {
    await sendWelcome(chatId, lang);
    return { ok: true, handled: true, action: 'link_required' };
  }

  if (text.startsWith('/unlink')) {
    const result = await unlinkTelegramByChatId(chatId);
    if (result.ok) {
      await sendTelegramMessage(chatId, pickCopy(COPY.unlinkedDone, lang));
      return { ok: true, handled: true, action: 'unlinked' };
    }
    await sendTelegramMessage(chatId, pickCopy(COPY.unlinked, lang));
    return { ok: true, handled: true, action: 'unlink_none' };
  }

  if (text.startsWith('/status')) {
    const date = linked.telegramLinkedAt
      ? linked.telegramLinkedAt.toISOString().slice(0, 10)
      : '—';
    await sendTelegramMessage(
      chatId,
      COPY.alreadyLinked[lang](linked.email, date),
    );
    return { ok: true, handled: true, action: 'status_linked' };
  }

  if (text.startsWith('/help')) {
    await sendTelegramMessage(chatId, pickCopy(COPY.help, lang));
    return { ok: true, handled: true, action: 'help' };
  }

  await sendTelegramMessage(
    chatId,
    lang === 'ar'
      ? 'ℹ️ استخدم /help لعرض الأوامر المتاحة.'
      : 'ℹ️ Use /help to see available commands.',
  );
  return { ok: true, handled: true, action: 'unknown_command' };
}

module.exports = {
  handleTelegramUpdate,
  extractStartPayload,
  botLang,
  COPY,
};
