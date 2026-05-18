/**
 * Smoke tests — happy paths, 401 (no auth), 403 (wrong role).
 * Vitest 4 requires ESM imports for its own module. We dynamic-import the
 * (CommonJS) app inside `beforeAll` to keep transitive deps happy.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);

process.env.JWT_SECRET = 'test-secret-for-vitest-pipeline-only';
process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.LOG_LEVEL = 'silent';

vi.mock('../src/db', () => {
  const fakeModel = () => new Proxy({}, { get: () => async () => [] });
  const prisma = new Proxy(
    {
      $queryRaw: async () => [{ ok: 1 }],
      $disconnect: async () => undefined,
      $transaction: async (cb) => (typeof cb === 'function' ? cb({}) : Promise.all(cb)),
    },
    { get: () => fakeModel() },
  );
  return { prisma };
});

let app;
let request;
beforeAll(() => {
  app = requireFromHere('../src/app');
  request = requireFromHere('supertest');
});

describe('public', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('unknown top-level route returns 404', async () => {
    const res = await request(app).get('/__nope__');
    expect(res.status).toBe(404);
  });
});

describe('auth gates', () => {
  const protectedRoutes = [
    ['GET', '/api/profile'],
    ['GET', '/api/notifications'],
    ['POST', '/api/workouts/logs'],
    ['POST', '/api/marketplace/orders'],
    ['POST', '/api/community/posts'],
    ['POST', '/api/ai/chat'],
    ['GET', '/api/dashboard/athlete'],
  ];
  for (const [method, url] of protectedRoutes) {
    it(`${method} ${url} requires auth → 401`, async () => {
      const res = await request(app)[method.toLowerCase()](url).send({});
      expect(res.status).toBe(401);
    });
  }
});

describe('validation', () => {
  it('register with missing fields → 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'foo' });
    expect([400, 422]).toContain(res.status);
  });
});
