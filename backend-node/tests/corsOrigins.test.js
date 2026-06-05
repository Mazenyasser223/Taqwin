import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { isOriginAllowed, isVercelOrigin } = requireFromHere('../src/lib/corsOrigins');

describe('corsOrigins', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    delete process.env.CORS_ALLOW_VERCEL;
  });

  afterEach(() => {
    if (envBackup.CORS_ALLOW_VERCEL === undefined) {
      delete process.env.CORS_ALLOW_VERCEL;
    } else {
      process.env.CORS_ALLOW_VERCEL = envBackup.CORS_ALLOW_VERCEL;
    }
  });

  it('allows explicit allowlist origins', () => {
    expect(
      isOriginAllowed('https://taqwin.vercel.app', ['https://taqwin.vercel.app'])
    ).toBe(true);
    expect(isOriginAllowed('https://evil.example', ['https://taqwin.vercel.app'])).toBe(false);
  });

  it('allows https *.vercel.app when CORS_ALLOW_VERCEL is enabled', () => {
    expect(isVercelOrigin('https://taqwin.vercel.app')).toBe(true);
    expect(isVercelOrigin('https://taqwin-git-main.vercel.app')).toBe(true);
    expect(isOriginAllowed('https://taqwin.vercel.app', [])).toBe(true);
    expect(isOriginAllowed('http://taqwin.vercel.app', [])).toBe(false);
  });

  it('blocks vercel.app when CORS_ALLOW_VERCEL=false', () => {
    process.env.CORS_ALLOW_VERCEL = 'false';
    expect(isOriginAllowed('https://taqwin.vercel.app', [])).toBe(false);
  });
});
