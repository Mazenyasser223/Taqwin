import { describe, expect, it, beforeEach, afterEach } from 'vitest';

const mod = require('../src/lib/normalizeMediaUrl');

describe('normalizeMediaUrl / publicUploadUrl', () => {
  const env = { ...process.env };

  beforeEach(() => {
    delete process.env.API_PUBLIC_URL;
    delete process.env.BACKEND_PUBLIC_URL;
    delete process.env.RENDER_EXTERNAL_URL;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it('resolveApiPublicBase prefers BACKEND_PUBLIC_URL when API_PUBLIC_URL is unset', () => {
    process.env.BACKEND_PUBLIC_URL = 'https://api.taqwin.online';
    expect(mod.resolveApiPublicBase()).toBe('https://api.taqwin.online');
  });

  it('publicUploadUrl uses BACKEND_PUBLIC_URL in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.BACKEND_PUBLIC_URL = 'https://api.taqwin.online';
    expect(mod.publicUploadUrl('posts/user-id/file.jpg')).toBe(
      'https://api.taqwin.online/uploads/posts/user-id/file.jpg',
    );
  });

  it('normalizeMediaUrl rewrites relative uploads with configured base', () => {
    process.env.BACKEND_PUBLIC_URL = 'https://api.taqwin.online';
    expect(mod.normalizeMediaUrl('/uploads/posts/u/a.jpg')).toBe(
      'https://api.taqwin.online/uploads/posts/u/a.jpg',
    );
  });
});
