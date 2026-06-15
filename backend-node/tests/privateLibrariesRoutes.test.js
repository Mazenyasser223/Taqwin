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

describe('private nutrition libraries', () => {
  it('GET /api/nutrition/foods includes public foods and only the user private foods', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    prisma.foodItem = { findMany };

    const res = await request(app).get('/api/nutrition/foods?search=oats').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: 'oats', mode: 'insensitive' },
          OR: [{ isPublic: true }, { userId: USER_ID }],
        }),
      })
    );
  });

  it('POST /api/nutrition/kitchen/meals/:id/log expands a saved meal into slot food logs', async () => {
    const meal = {
      id: '22222222-2222-4222-8222-222222222222',
      userId: USER_ID,
      defaultSlotId: 'breakfast',
      items: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          foodItemId: '44444444-4444-4444-8444-444444444444',
          name: 'Private oats',
          grams: 80,
          foodItem: { id: '44444444-4444-4444-8444-444444444444' },
        },
      ],
    };
    prisma.userMeal = { findFirst: vi.fn().mockResolvedValue(meal) };
    prisma.foodItem = {
      findFirst: vi.fn().mockResolvedValue({ id: '44444444-4444-4444-8444-444444444444' }),
    };
    prisma.foodLog = {
      create: vi.fn().mockResolvedValue({ id: '55555555-5555-4555-8555-555555555555' }),
    };
    prisma.userSettings = {
      findUnique: vi.fn().mockResolvedValue({ timezone: 'UTC', language: 'en' }),
    };

    const res = await request(app)
      .post(`/api/nutrition/kitchen/meals/${meal.id}/log`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-06-14', slotId: 'lunch' });

    expect(res.status).toBe(201);
    expect(res.body.logIds).toEqual(['55555555-5555-4555-8555-555555555555']);
    expect(prisma.foodLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: USER_ID,
        foodItemId: '44444444-4444-4444-8444-444444444444',
        grams: 80,
        mealSlotId: 'lunch',
      }),
    });
  });
});
