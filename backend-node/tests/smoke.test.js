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
}, 60000);

describe('public', () => {
  it('GET / returns service info', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('taqwin-api');
    expect(res.body.health).toBe('/health');
  });

  it('GET /health returns ok with store probes', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(['ok', 'degraded']).toContain(res.body.status);
    expect(res.body.stores).toBeDefined();
    expect(res.body.stores.postgres).toBeDefined();
    expect(res.body.stores.redis).toBeDefined();
    expect(res.body.stores.mongo).toBeDefined();
    expect(res.body.stores.pgvector).toBeDefined();
    expect(res.body.features).toBeDefined();
    expect(typeof res.body.uptimeSec).toBe('number');
  });

  it('GET /health/live returns 200 liveness', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptimeSec).toBe('number');
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

const TEST_INTERNAL_KEY = 'test-internal-key-min-16-chars';

describe('internal AI (Block A4)', () => {
  it('POST /api/internal/ai/tools/execute rejects missing X-Internal-Key', async () => {
    const res = await request(app)
      .post('/api/internal/ai/tools/execute')
      .send({
        userId: '11111111-1111-4111-8111-111111111111',
        toolName: 'ping',
      });
    expect(res.status).toBe(401);
  });

  it('POST /api/internal/ai/tools/execute runs ping stub', async () => {
    const res = await request(app)
      .post('/api/internal/ai/tools/execute')
      .set('X-Internal-Key', TEST_INTERNAL_KEY)
      .send({
        userId: '11111111-1111-4111-8111-111111111111',
        toolName: 'ping',
        input: {},
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.output).toMatchObject({ ok: true, block: 'A4' });
    expect(res.body.executionId).toBe('exec-test-1');
  });
});

describe('validation', () => {
  it('register with missing fields → 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'foo' });
    expect([400, 422]).toContain(res.status);
  });
});
