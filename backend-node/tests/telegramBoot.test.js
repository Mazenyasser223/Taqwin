/**
 * Telegram transport boot — polling vs webhook in dev/production.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const { shouldUseTelegramPolling } = require('../src/lib/telegram/telegramPolling.js');

describe('shouldUseTelegramPolling', () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it('uses polling when TELEGRAM_POLLING=true even with BACKEND_PUBLIC_URL', () => {
    process.env.TELEGRAM_POLLING = 'true';
    process.env.BACKEND_PUBLIC_URL = 'https://api.taqwin.online';
    process.env.NODE_ENV = 'development';
    expect(shouldUseTelegramPolling()).toBe(true);
  });

  it('uses webhook in production when polling is not forced', () => {
    delete process.env.TELEGRAM_POLLING;
    process.env.NODE_ENV = 'production';
    process.env.BACKEND_PUBLIC_URL = 'https://api.taqwin.online';
    expect(shouldUseTelegramPolling()).toBe(false);
  });

  it('defaults to polling in development without explicit webhook URL', () => {
    delete process.env.TELEGRAM_POLLING;
    process.env.NODE_ENV = 'development';
    process.env.BACKEND_PUBLIC_URL = 'https://api.taqwin.online';
    expect(shouldUseTelegramPolling()).toBe(true);
  });

  it('respects TELEGRAM_USE_WEBHOOK=true in development', () => {
    process.env.NODE_ENV = 'development';
    process.env.TELEGRAM_USE_WEBHOOK = 'true';
    expect(shouldUseTelegramPolling()).toBe(false);
  });
});
