/**
 * Smoke tests — public routes, 401 without auth, basic validation.
 * Prisma is mocked in tests/setup.cjs (see vitest.config.js).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);

/** Load once — app pulls many route modules; CI runners can be slower than local dev. */
const request = requireFromHere('supertest');
let app;

beforeAll(() => {
  app = requireFromHere('../src/app');
}, 25000);

describe('public', () => {
  it('GET / returns service info', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('taqwin-api');
    expect(res.body.health).toBe('/health');
  });

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
