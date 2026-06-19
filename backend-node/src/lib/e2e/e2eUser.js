/**
 * E2E test user provisioning — idempotent reset for Playwright runs.
 */
const bcrypt = require('bcryptjs');
const { prisma } = require('../../db');
const { DEFAULTS } = require('../userSettings');

const E2E_EMAIL = process.env.E2E_SETTINGS_EMAIL || 'e2e-settings@taqwin.test';
const E2E_PASSWORD = process.env.E2E_SETTINGS_PASSWORD || 'E2eTestPass1!';

async function ensureE2eSettingsUser() {
  const email = E2E_EMAIL.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(E2E_PASSWORD, 10);

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'athlete',
        emailVerifiedAt: new Date(),
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        emailVerifiedAt: user.emailVerifiedAt || new Date(),
        twoFactorEnabled: false,
        twoFactorSecret: null,
        telegramChatId: null,
        telegramLinkedAt: null,
        telegramLinkToken: null,
        telegramLinkTokenExpiresAt: null,
        tokenVersion: 0,
        pendingEmail: null,
        emailChangeCode: null,
        emailChangeCodeExpiry: null,
        phone: null,
        phoneVerifiedAt: null,
      },
    });
  }

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...DEFAULTS },
    update: {
      ...DEFAULTS,
      telegramEnabled: false,
    },
  });

  await prisma.athleteProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      displayName: 'E2E Settings User',
      onboardingData: { completed: true },
    },
    update: {
      displayName: 'E2E Settings User',
      onboardingData: { completed: true },
    },
  });

  return { userId: user.id, email, password: E2E_PASSWORD };
}

async function mockTelegramLink(userId, chatId = `e2e-telegram-${userId.slice(0, 8)}`) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      telegramChatId: String(chatId),
      telegramLinkedAt: new Date(),
      telegramLinkToken: null,
      telegramLinkTokenExpiresAt: null,
    },
  });
  await prisma.userSettings.update({
    where: { userId },
    data: { telegramEnabled: true },
  });
  return { linked: true, chatId: String(chatId) };
}

async function unlinkTelegramForUser(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      telegramChatId: null,
      telegramLinkedAt: null,
    },
  });
  await prisma.userSettings.update({
    where: { userId },
    data: { telegramEnabled: false },
  });
}

async function createDisposableUser(suffix = Date.now()) {
  const email = `e2e-disposable-${suffix}@taqwin.test`;
  const passwordHash = await bcrypt.hash(E2E_PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'athlete',
      emailVerifiedAt: new Date(),
    },
  });
  await prisma.userSettings.create({
    data: { userId: user.id, ...DEFAULTS },
  });
  await prisma.athleteProfile.create({
    data: {
      userId: user.id,
      displayName: 'Disposable E2E',
      onboardingData: { completed: true },
    },
  });
  return { userId: user.id, email, password: E2E_PASSWORD };
}

async function deleteUserById(userId) {
  await prisma.user.delete({ where: { id: userId } }).catch(() => null);
}

module.exports = {
  E2E_EMAIL,
  E2E_PASSWORD,
  ensureE2eSettingsUser,
  mockTelegramLink,
  unlinkTelegramForUser,
  createDisposableUser,
  deleteUserById,
};
