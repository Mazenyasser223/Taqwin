/**
 * Telegram webhook — unlinked user gating + link payload parsing.
 */
import { describe, it, expect, beforeEach } from 'vitest';

const { prisma } = require('../src/db.js');
const { handleTelegramUpdate, extractStartPayload, botLang } = require(
  '../src/lib/telegram/telegramWebhook.js',
);

function messageUpdate(text, lang = 'ar') {
  return {
    message: {
      chat: { id: 999999999 },
      text,
      from: { id: 1, language_code: lang },
    },
  };
}

describe('telegramWebhook', () => {
  const originalFindUnique = prisma.user.findUnique;

  beforeEach(() => {
    prisma.user.findUnique = originalFindUnique;
  });

  it('parses LINK start payload', () => {
    expect(extractStartPayload('/start LINK_abc123')).toBe('LINK_abc123');
    expect(extractStartPayload('/start')).toBeNull();
  });

  it('resolves bot language from Telegram user', () => {
    expect(botLang({ language_code: 'ar-EG' })).toBe('ar');
    expect(botLang({ language_code: 'en' })).toBe('en');
  });

  it('welcomes unlinked users on /start', async () => {
    const result = await handleTelegramUpdate(messageUpdate('/start'));
    expect(result).toMatchObject({ ok: true, handled: true, action: 'welcome' });
  });

  it('blocks /status for unlinked users', async () => {
    const result = await handleTelegramUpdate(messageUpdate('/status'));
    expect(result).toMatchObject({ ok: true, handled: true, action: 'link_required' });
  });

  it('blocks plain text for unlinked users', async () => {
    const result = await handleTelegramUpdate(messageUpdate('hello'));
    expect(result).toMatchObject({ ok: true, handled: true, action: 'link_required' });
  });

  it('allows /status for linked users', async () => {
    prisma.user.findUnique = async () => ({
      id: 'u1',
      email: 'user@test.com',
      telegramLinkedAt: new Date('2026-01-15'),
    });
    const result = await handleTelegramUpdate(messageUpdate('/status', 'en'));
    expect(result).toMatchObject({ ok: true, handled: true, action: 'status_linked' });
  });
});
