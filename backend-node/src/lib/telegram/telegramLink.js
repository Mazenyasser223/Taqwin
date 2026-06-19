/**
 * Link Taqwin accounts to Telegram via one-time deep-link tokens.
 */
const { randomBytes } = require('crypto');
const { prisma } = require('../../db');
const { getBotUsername } = require('./telegramClient');

const TOKEN_TTL_MS = 15 * 60 * 1000;

function generateLinkToken() {
  return randomBytes(24).toString('hex');
}

async function createTelegramLinkToken(userId) {
  const token = generateLinkToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.user.update({
    where: { id: userId },
    data: {
      telegramLinkToken: token,
      telegramLinkTokenExpiresAt: expiresAt,
    },
  });

  const botUsername = getBotUsername();
  const deepLink = `https://t.me/${botUsername}?start=LINK_${token}`;

  return { token, expiresAt, deepLink, botUsername };
}

async function linkTelegramByToken(token, chatId, telegramUser = {}) {
  if (!token || !chatId) return { ok: false, reason: 'missing_token_or_chat' };

  const user = await prisma.user.findFirst({
    where: {
      telegramLinkToken: token,
      telegramLinkTokenExpiresAt: { gt: new Date() },
    },
    select: { id: true, telegramChatId: true },
  });

  if (!user) return { ok: false, reason: 'invalid_or_expired_token' };

  const existing = await prisma.user.findUnique({
    where: { telegramChatId: String(chatId) },
    select: { id: true },
  });
  if (existing && existing.id !== user.id) {
    return { ok: false, reason: 'chat_already_linked' };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        telegramChatId: String(chatId),
        telegramLinkedAt: new Date(),
        telegramLinkToken: null,
        telegramLinkTokenExpiresAt: null,
      },
    }),
    prisma.userSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, telegramEnabled: true },
      update: { telegramEnabled: true },
    }),
  ]);

  return {
    ok: true,
    userId: user.id,
    telegramUsername: telegramUser.username || null,
  };
}

async function unlinkTelegram(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      telegramChatId: null,
      telegramLinkedAt: null,
      telegramLinkToken: null,
      telegramLinkTokenExpiresAt: null,
    },
  });
  await prisma.userSettings.updateMany({
    where: { userId },
    data: { telegramEnabled: false },
  });
  return { ok: true };
}

async function unlinkTelegramByChatId(chatId) {
  const user = await prisma.user.findUnique({
    where: { telegramChatId: String(chatId) },
    select: { id: true },
  });
  if (!user) return { ok: false, reason: 'not_linked' };
  return unlinkTelegram(user.id);
}

async function getTelegramStatus(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      telegramChatId: true,
      telegramLinkedAt: true,
    },
  });
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { telegramEnabled: true },
  });

  return {
    linked: Boolean(user?.telegramChatId),
    linkedAt: user?.telegramLinkedAt || null,
    enabled: Boolean(settings?.telegramEnabled && user?.telegramChatId),
    botUsername: getBotUsername(),
  };
}

module.exports = {
  createTelegramLinkToken,
  linkTelegramByToken,
  unlinkTelegram,
  unlinkTelegramByChatId,
  getTelegramStatus,
  TOKEN_TTL_MS,
};
