/**
 * Gym staff route auth gates — uses mocked Prisma (see tests/setup.cjs).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const request = require('supertest');
const jwt = require('jsonwebtoken');

let app;
const gymId = '00000000-0000-4000-8000-000000000001';

beforeAll(() => {
  app = require('../src/app');
}, 25000);

describe('gym staff routes auth', () => {
  it('GET /api/gyms/:id/staff requires auth → 401', async () => {
    const res = await request(app).get(`/api/gyms/${gymId}/staff`);
    expect(res.status).toBe(401);
  });

  it('POST /api/gyms/:id/staff requires auth → 401', async () => {
    const res = await request(app).post(`/api/gyms/${gymId}/staff`).send({ fullName: 'Test' });
    expect(res.status).toBe(401);
  });

  it('GET /api/gyms/:id/staff/payroll/export requires auth → 401', async () => {
    const res = await request(app).get(`/api/gyms/${gymId}/staff/payroll/export`);
    expect(res.status).toBe(401);
  });

  it('athlete token cannot access staff routes → 403', async () => {
    const token = jwt.sign({ sub: '00000000-0000-4000-8000-000000000099', role: 'athlete' }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
    const res = await request(app)
      .get(`/api/gyms/${gymId}/staff`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
