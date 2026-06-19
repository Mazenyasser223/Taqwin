import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import jwt from 'jsonwebtoken';

const requireFromHere = createRequire(import.meta.url);
const request = requireFromHere('supertest');
const { prisma } = requireFromHere('./mocks/db.cjs');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const token = jwt.sign({ sub: USER_ID, email: 'athlete@test.local', role: 'athlete' }, process.env.JWT_SECRET);

let app;

beforeAll(() => {
  app = requireFromHere('../src/app');
}, 60000);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('saved workout routines', () => {
  it('POST /api/plans/routines/:id/apply returns success when append finds only duplicates', async () => {
    const routine = {
      id: '22222222-2222-4222-8222-222222222222',
      userId: USER_ID,
      name: 'Push day',
      focus: 'Push',
      exercises: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          exerciseId: '44444444-4444-4444-8444-444444444444',
          sets: 3,
          reps: '10',
          restSec: 90,
          notes: null,
          exercise: { id: '44444444-4444-4444-8444-444444444444', name: 'Bench', nameAr: null, category: 'chest' },
        },
      ],
    };
    const targetDay = {
      id: '55555555-5555-4555-8555-555555555555',
      dayIndex: 1,
      focus: 'Push',
      exercises: [{ exerciseId: '44444444-4444-4444-8444-444444444444' }],
      plan: { id: '66666666-6666-4666-8666-666666666666', userId: USER_ID },
    };

    prisma.savedWorkoutRoutine = { findFirst: vi.fn().mockResolvedValue(routine) };
    prisma.userSettings = { findUnique: vi.fn().mockResolvedValue({ timezone: 'UTC', language: 'en' }) };
    prisma.workoutPlan = {
      findFirst: vi.fn().mockResolvedValue({
        id: '66666666-6666-4666-8666-666666666666',
        userId: USER_ID,
        source: 'manual',
        weekStart: new Date('2026-06-14T00:00:00.000Z'),
        days: [{ id: targetDay.id, dayIndex: 1 }],
      }),
    };
    prisma.dietPlan = { findFirst: vi.fn().mockResolvedValue(null) };
    prisma.dailyAthletePlan = {
      upsert: vi.fn().mockResolvedValue({ id: 'daily', workoutPlanDay: targetDay, dietPlanDay: null }),
    };
    prisma.workoutPlanDay = { findFirst: vi.fn().mockResolvedValue(targetDay) };

    const res = await request(app)
      .post(`/api/plans/routines/${routine.id}/apply`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-06-14', mode: 'append' });

    expect(res.status).toBe(200);
    expect(res.body.added).toBe(0);
    expect(res.body.duplicateExerciseIds).toEqual(['44444444-4444-4444-8444-444444444444']);
  });
});
