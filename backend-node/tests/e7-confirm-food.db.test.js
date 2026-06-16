/**
 * E7 Vitest DB suite — real Postgres (no Prisma mock).
 * Run: npm run test:db  (requires DATABASE_URL + migrations)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import http from 'node:http';
import request from 'supertest';

const requireFromHere = createRequire(import.meta.url);
const WebSocket = requireFromHere('ws');
const {
  configureConfirmEnv,
  signToken,
  ensureFixtures,
  countFoodLogs,
} = requireFromHere('./helpers/e7Fixtures.cjs');
const { wsAuth, wsCoachConfirm } = requireFromHere('./helpers/e7Ws.cjs');
const { attachWebSocketHub, shutdownWebSocketHub } = requireFromHere('../src/realtime/wsHub');

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const describeDb = hasDb ? describe : describe.skip;

describeDb('E7 confirm → FoodLog (Vitest DB)', () => {
  /** @type {import('@prisma/client').PrismaClient} */
  let prisma;
  let app;
  let user;
  let food;
  let savePendingAction;
  let getPendingByActionId;

  beforeAll(async () => {
    configureConfirmEnv();
    ({ prisma } = requireFromHere('../src/db'));
    ({ savePendingAction, getPendingByActionId } = requireFromHere(
      '../src/services/pendingActionService',
    ));
    app = requireFromHere('../src/app');
    ({ user, food } = await ensureFixtures(prisma));
  });

  afterAll(async () => {
    await prisma?.$disconnect().catch(() => {});
  });

  it('POST /confirm inserts FoodLog row', async () => {
    const grams = 210;
    const conversationId = `vitest-e7-rest-${Date.now()}`;
    const before = await countFoodLogs(prisma, user.id, food.id, grams);

    const { actionId } = await savePendingAction({
      userId: user.id,
      conversationId,
      tools: ['log_food'],
      inputsByTool: {
        log_food: { foodItemId: food.id, foodName: food.name, grams },
      },
      preview: `Log food: ${food.name} (${grams}g)`,
      intent: 'execute_action',
      userMessage: `log ${grams}g ${food.name}`,
      locale: 'en',
      phase: 'confirm',
    });

    const token = signToken(user);
    const res = await request(app)
      .post('/api/ai/chat/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ actionId, conversationId, locale: 'en' });

    expect(res.status).toBe(200);
    expect(res.body.confirmationRequired).toBe(false);

    const after = await countFoodLogs(prisma, user.id, food.id, grams);
    expect(after).toBe(before + 1);
    expect(await getPendingByActionId(user.id, actionId)).toBeNull();
  });

  it('WebSocket coach.confirm inserts FoodLog row', async () => {
    const grams = 211;
    const conversationId = `vitest-e7-ws-${Date.now()}`;
    const before = await countFoodLogs(prisma, user.id, food.id, grams);

    const { actionId } = await savePendingAction({
      userId: user.id,
      conversationId,
      tools: ['log_food'],
      inputsByTool: {
        log_food: { foodItemId: food.id, foodName: food.name, grams },
      },
      preview: `Log food: ${food.name}`,
      intent: 'execute_action',
      userMessage: `log ${grams}g ${food.name}`,
      locale: 'en',
      phase: 'confirm',
    });

    const token = signToken(user);
    const server = http.createServer(app);
    attachWebSocketHub(server);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    try {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      await new Promise((resolve, reject) => {
        ws.once('open', resolve);
        ws.once('error', reject);
      });

      await wsAuth(ws, token);
      const done = await wsCoachConfirm(ws, { actionId, conversationId, locale: 'en' });
      expect(done.afterConfirm).toBe(true);
      expect(done.confirmationRequired).toBe(false);

      const after = await countFoodLogs(prisma, user.id, food.id, grams);
      expect(after).toBe(before + 1);
      ws.close();
    } finally {
      await shutdownWebSocketHub();
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
