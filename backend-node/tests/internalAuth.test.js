import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { internalAuthMiddleware } = requireFromHere('../src/middleware/internalAuth');

function mockReqRes(headers = {}) {
  const req = { headers };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('internalAuthMiddleware', () => {
  const envBackup = process.env.AI_INTERNAL_KEY;

  afterEach(() => {
    if (envBackup === undefined) delete process.env.AI_INTERNAL_KEY;
    else process.env.AI_INTERNAL_KEY = envBackup;
  });

  beforeEach(() => {
    process.env.AI_INTERNAL_KEY = 'test-internal-key-min-16';
  });

  it('rejects missing header', () => {
    const { req, res, next } = mockReqRes();
    internalAuthMiddleware(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects wrong key', () => {
    const { req, res, next } = mockReqRes({ 'x-internal-key': 'wrong' });
    internalAuthMiddleware(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows valid key', () => {
    const { req, res, next } = mockReqRes({
      'x-internal-key': 'test-internal-key-min-16',
    });
    internalAuthMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 503 when AI_INTERNAL_KEY not set', () => {
    delete process.env.AI_INTERNAL_KEY;
    const { req, res, next } = mockReqRes({ 'x-internal-key': 'x' });
    internalAuthMiddleware(req, res, next);
    expect(res.statusCode).toBe(503);
  });
});
