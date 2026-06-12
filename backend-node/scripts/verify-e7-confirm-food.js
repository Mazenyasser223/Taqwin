/* eslint-disable no-console */
/**
 * Block E7 — Live DB E2E: coach confirm flow → Postgres food_logs row.
 *
 *   npm run verify:e7-confirm-food           # static wiring checks
 *   npm run verify:e7-confirm-food -- --db    # + Postgres integration scenarios
 *   npm run verify:e7-confirm-food:db         # alias for --db
 *
 * CI: pgvector Postgres, `prisma migrate deploy`, JWT_SECRET.
 * Confirm execution uses Node aiToolExecutor (FEATURE_AI_VIA_FASTAPI=false).
 * Chat→pending scenarios stub FastAPI via fastApiResult / chatViaFastApi patch.
 */
require('dotenv').config({ override: true });

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const request = require('supertest');

const root = path.join(__dirname, '..');
const src = path.join(root, 'src');
const DB = process.argv.includes('--db');
const LIVE_FASTAPI = process.argv.includes('--live-fastapi');

const {
  configureConfirmEnv,
  configureChatEnv,
  signToken,
  ensureFixtures,
  countFoodLogs,
  fastApiFoodLogStub,
  TEST_FOOD_NAME,
  TEST_FOOD_ALT_NAME,
} = require('../tests/helpers/e7Fixtures.cjs');
const { wsAuth, wsCoachConfirm } = require('../tests/helpers/e7Ws.cjs');
const {
  waitForHealth,
  startNodeServer,
  startAiService,
  stopProcess,
  stopNodeServer,
} = require('./lib/e7-services.cjs');

function read(rel) {
  return fs.readFileSync(path.join(src, rel), 'utf8');
}

function readRoot(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function ok(msg) {
  console.log(`OK  ${msg}`);
  return true;
}

function fail(msg) {
  console.log(`FAIL ${msg}`);
  return false;
}

function staticChecks() {
  let failed = 0;
  console.log('── static checks ──\n');

  const aiRoutes = read('routes/ai.js');
  const coachActions = read('services/coachChatActions.js');
  const executor = read('services/aiToolExecutor.js');
  const schema = readRoot('prisma/schema.prisma');
  const pkg = JSON.parse(readRoot('package.json'));
  const ciYml = fs.existsSync(path.join(root, '..', '.github', 'workflows', 'ci.yml'))
    ? fs.readFileSync(path.join(root, '..', '.github', 'workflows', 'ci.yml'), 'utf8')
    : '';

  const checks = [
    {
      name: 'POST /api/ai/chat/confirm route exists',
      ok: () => aiRoutes.includes("router.post('/chat/confirm'"),
    },
    {
      name: 'POST /api/ai/chat/cancel route exists',
      ok: () => aiRoutes.includes("router.post('/chat/cancel'"),
    },
    {
      name: 'POST /api/ai/chat/disambiguate route exists',
      ok: () => aiRoutes.includes("router.post('/chat/disambiguate'"),
    },
    {
      name: 'GET /api/ai/chat/pending route exists',
      ok: () => aiRoutes.includes("router.get('/chat/pending'"),
    },
    {
      name: 'confirm wired via processCoachConfirm',
      ok: () => aiRoutes.includes('processCoachConfirm'),
    },
    {
      name: 'executePendingAction wired in coachChatActions',
      ok: () => coachActions.includes('executePendingAction'),
    },
    {
      name: 'log_food writes FoodLog via prisma',
      ok: () => executor.includes('prisma.foodLog.create'),
    },
    {
      name: 'log_food records AiToolExecution audit',
      ok: () => executor.includes('prisma.aiToolExecution.create'),
    },
    {
      name: 'Prisma FoodLog model mapped to food_logs',
      ok: () => schema.includes('model FoodLog') && schema.includes('@@map("food_logs")'),
    },
    {
      name: 'package.json verify:e7-confirm-food script',
      ok: () => typeof pkg.scripts['verify:e7-confirm-food'] === 'string',
    },
    {
      name: 'CI runs E7 integration (DB + live FastAPI + cross-service)',
      ok: () =>
        ciYml.includes('verify:e7-integration') ||
        (ciYml.includes('verify:e7-confirm-food') && ciYml.includes('test:db')),
    },
    {
      name: 'Vitest DB suite (test:db) configured',
      ok: () => {
        const vitestDb = readRoot('vitest.db.config.js');
        return vitestDb.includes('e7-confirm-food.db.test.js') || vitestDb.includes('*.db.test.js');
      },
    },
    {
      name: 'cross-service verify script exists',
      ok: () => fs.existsSync(path.join(__dirname, 'verify-e7-cross-service.js')),
    },
  ];

  for (const c of checks) {
    if (c.ok()) ok(c.name);
    else {
      fail(c.name);
      failed += 1;
    }
  }

  return failed;
}

async function scenarioDirectConfirm({ prisma, app, user, food, savePendingAction, getPendingByActionId }) {
  let failed = 0;
  console.log('\n  [1] direct pending → confirm → FoodLog');

  configureConfirmEnv();
  const grams = 200;
  const conversationId = `ci-e7-direct-${Date.now()}`;
  const token = signToken(user);
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

  const res = await request(app)
    .post('/api/ai/chat/confirm')
    .set('Authorization', `Bearer ${token}`)
    .send({ actionId, conversationId, locale: 'en' });

  if (res.status !== 200) {
    fail(`confirm → ${res.status} ${JSON.stringify(res.body)}`);
    failed += 1;
  } else ok('confirm HTTP 200');

  if (res.body?.confirmationRequired !== false) {
    fail(`confirmationRequired expected false, got ${res.body?.confirmationRequired}`);
    failed += 1;
  } else ok('confirmationRequired=false');

  const after = await countFoodLogs(prisma, user.id, food.id, grams);
  if (after !== before + 1) {
    fail(`FoodLog count expected ${before + 1}, got ${after}`);
    failed += 1;
  } else ok('FoodLog row inserted');

  if (await getPendingByActionId(user.id, actionId)) {
    fail('pending not cleared');
    failed += 1;
  } else ok('pending cleared');

  const execRow = await prisma.aiToolExecution.findFirst({
    where: { userId: user.id, toolName: 'log_food', success: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!execRow) {
    fail('AiToolExecution audit missing');
    failed += 1;
  } else ok(`AiToolExecution id=${execRow.id}`);

  return failed;
}

async function scenarioChatTurnThenConfirm({ prisma, app, user, food }) {
  let failed = 0;
  console.log('\n  [2] chat turn (stubbed FastAPI) → confirm → FoodLog');

  configureChatEnv();
  const { processCoachChatTurn } = require('../src/services/coachChatTurn');
  configureConfirmEnv();

  const grams = 201;
  const conversationId = `ci-e7-chat-turn-${Date.now()}`;
  const token = signToken(user);
  const before = await countFoodLogs(prisma, user.id, food.id, grams);

  configureChatEnv();
  const turn = await processCoachChatTurn(user.id, {
    messages: [{ role: 'user', content: `log ${grams}g ${food.name}` }],
    locale: 'en',
    conversationId,
    fastApiResult: fastApiFoodLogStub(food, grams),
  });
  configureConfirmEnv();

  if (!turn.ok || !turn.data?.actionId) {
    fail(`chat turn failed: ${JSON.stringify(turn)}`);
    return failed + 1;
  }
  ok(`chat turn stored pending actionId=${turn.data.actionId}`);

  if (!turn.data.confirmationRequired) {
    fail('chat turn expected confirmationRequired=true');
    failed += 1;
  } else ok('chat turn confirmationRequired=true');

  const res = await request(app)
    .post('/api/ai/chat/confirm')
    .set('Authorization', `Bearer ${token}`)
    .send({ actionId: turn.data.actionId, conversationId, locale: 'en' });

  if (res.status !== 200) {
    fail(`confirm after chat → ${res.status}`);
    failed += 1;
  } else ok('confirm after chat HTTP 200');

  const after = await countFoodLogs(prisma, user.id, food.id, grams);
  if (after !== before + 1) {
    fail(`FoodLog after chat+confirm expected ${before + 1}, got ${after}`);
    failed += 1;
  } else ok('FoodLog row after chat+confirm');

  return failed;
}

async function scenarioHttpChatThenConfirm({ prisma, app, user, food, chatStubHolder }) {
  let failed = 0;
  console.log('\n  [3] HTTP POST /chat (stubbed) → confirm → FoodLog');

  configureChatEnv();
  const grams = 202;
  const conversationId = `ci-e7-http-chat-${Date.now()}`;
  const token = signToken(user);
  const before = await countFoodLogs(prisma, user.id, food.id, grams);

  chatStubHolder.set(() => fastApiFoodLogStub(food, grams));

  try {
    const chatRes = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        messages: [{ role: 'user', content: `log ${grams}g ${food.name}` }],
        locale: 'en',
        conversationId,
      });

    if (chatRes.status !== 200) {
      fail(`POST /chat → ${chatRes.status} ${JSON.stringify(chatRes.body)}`);
      failed += 1;
      return failed;
    }
    ok('POST /chat HTTP 200');

    if (!chatRes.body?.actionId) {
      fail('POST /chat missing actionId');
      failed += 1;
      return failed;
    }
    ok(`POST /chat actionId=${chatRes.body.actionId}`);

    configureConfirmEnv();
    const confirmRes = await request(app)
      .post('/api/ai/chat/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ actionId: chatRes.body.actionId, conversationId, locale: 'en' });

    if (confirmRes.status !== 200) {
      fail(`confirm after HTTP chat → ${confirmRes.status}`);
      failed += 1;
    } else ok('confirm after HTTP chat HTTP 200');

    const after = await countFoodLogs(prisma, user.id, food.id, grams);
    if (after !== before + 1) {
      fail(`FoodLog after HTTP chat+confirm expected ${before + 1}, got ${after}`);
      failed += 1;
    } else ok('FoodLog row after HTTP chat+confirm');
  } finally {
    chatStubHolder.clear();
    configureConfirmEnv();
  }

  return failed;
}

async function scenarioCancelNoFoodLog({ prisma, app, user, food, savePendingAction, getPendingByActionId }) {
  let failed = 0;
  console.log('\n  [4] cancel → no FoodLog, pending cleared');

  configureConfirmEnv();
  const grams = 150;
  const conversationId = `ci-e7-cancel-${Date.now()}`;
  const token = signToken(user);
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

  const res = await request(app)
    .post('/api/ai/chat/cancel')
    .set('Authorization', `Bearer ${token}`)
    .send({ actionId, conversationId, locale: 'en' });

  if (res.status !== 200) {
    fail(`cancel → ${res.status}`);
    failed += 1;
  } else ok('cancel HTTP 200');

  const after = await countFoodLogs(prisma, user.id, food.id, grams);
  if (after !== before) {
    fail(`FoodLog count changed on cancel (${before} → ${after})`);
    failed += 1;
  } else ok('FoodLog count unchanged after cancel');

  if (await getPendingByActionId(user.id, actionId)) {
    fail('pending not cleared after cancel');
    failed += 1;
  } else ok('pending cleared after cancel');

  return failed;
}

async function scenarioGuardrails({ app, user, otherUser, savePendingAction }) {
  let failed = 0;
  console.log('\n  [5] auth + action guardrails');

  configureConfirmEnv();
  const conversationId = `ci-e7-guard-${Date.now()}`;
  const grams = 180;
  const token = signToken(user);

  const noAuth = await request(app)
    .post('/api/ai/chat/confirm')
    .send({ actionId: crypto.randomUUID(), conversationId, locale: 'en' });
  if (noAuth.status !== 401) {
    fail(`missing auth expected 401, got ${noAuth.status}`);
    failed += 1;
  } else ok('missing auth → 401');

  const unknownId = crypto.randomUUID();
  const notFound = await request(app)
    .post('/api/ai/chat/confirm')
    .set('Authorization', `Bearer ${token}`)
    .send({ actionId: unknownId, conversationId, locale: 'en' });
  if (notFound.status !== 404) {
    fail(`unknown actionId expected 404, got ${notFound.status}`);
    failed += 1;
  } else ok('unknown actionId → 404');

  const { actionId } = await savePendingAction({
    userId: user.id,
    conversationId,
    tools: ['log_food'],
    inputsByTool: { log_food: { foodName: 'x', grams } },
    preview: 'x',
    intent: 'execute_action',
    userMessage: 'x',
    locale: 'en',
    phase: 'confirm',
  });

  const otherToken = signToken(otherUser);
  const wrongUser = await request(app)
    .post('/api/ai/chat/confirm')
    .set('Authorization', `Bearer ${otherToken}`)
    .send({ actionId, conversationId, locale: 'en' });
  if (wrongUser.status !== 404) {
    fail(`wrong user expected 404, got ${wrongUser.status}`);
    failed += 1;
  } else ok('wrong user → 404');

  return failed;
}

async function scenarioGetPending({ app, user, food, savePendingAction }) {
  let failed = 0;
  console.log('\n  [6] GET /chat/pending returns active action');

  configureConfirmEnv();
  const conversationId = `ci-e7-pending-${Date.now()}`;
  const token = signToken(user);
  const preview = `Log food: ${food.name} (190g)`;

  const { actionId } = await savePendingAction({
    userId: user.id,
    conversationId,
    tools: ['log_food'],
    inputsByTool: {
      log_food: { foodItemId: food.id, foodName: food.name, grams: 190 },
    },
    preview,
    intent: 'execute_action',
    userMessage: 'log food',
    locale: 'en',
    phase: 'confirm',
  });

  const res = await request(app)
    .get('/api/ai/chat/pending')
    .query({ conversationId })
    .set('Authorization', `Bearer ${token}`);

  if (res.status !== 200) {
    fail(`GET pending → ${res.status}`);
    failed += 1;
    return failed;
  }

  if (res.body?.pending?.actionId !== actionId) {
    fail(`pending actionId mismatch: ${res.body?.pending?.actionId}`);
    failed += 1;
  } else ok('GET pending returns actionId');

  if (!String(res.body?.pending?.confirmationPreview || '').includes(food.name)) {
    fail('GET pending missing confirmation preview');
    failed += 1;
  } else ok('GET pending includes preview');

  return failed;
}

async function scenarioDisambiguateThenConfirm({
  prisma,
  app,
  user,
  food,
  foodAlt,
  savePendingAction,
  getPendingByActionId,
}) {
  let failed = 0;
  console.log('\n  [7] disambiguate → confirm → FoodLog');

  configureConfirmEnv();
  const grams = 203;
  const conversationId = `ci-e7-disambig-${Date.now()}`;
  const token = signToken(user);
  const before = await countFoodLogs(prisma, user.id, foodAlt.id, grams);

  const { actionId } = await savePendingAction({
    userId: user.id,
    conversationId,
    tools: ['log_food'],
    inputsByTool: { log_food: { rawText: `${grams}g chicken`, grams } },
    preview: 'Log food: chicken',
    intent: 'execute_action',
    userMessage: `log ${grams}g chicken`,
    locale: 'en',
    phase: 'disambiguation',
    disambiguation: {
      kind: 'food',
      query: 'chicken',
      grams,
      candidates: [
        { foodItemId: food.id, foodName: food.name, grams },
        { foodItemId: foodAlt.id, foodName: foodAlt.name, grams },
      ],
    },
  });

  const pickRes = await request(app)
    .post('/api/ai/chat/disambiguate')
    .set('Authorization', `Bearer ${token}`)
    .send({ actionId, conversationId, locale: 'en', foodItemId: foodAlt.id });

  if (pickRes.status !== 200) {
    fail(`disambiguate → ${pickRes.status} ${JSON.stringify(pickRes.body)}`);
    failed += 1;
    return failed;
  }
  ok('disambiguate HTTP 200');

  if (!pickRes.body?.confirmationRequired) {
    fail('disambiguate expected confirmationRequired=true');
    failed += 1;
  } else ok('disambiguate confirmationRequired=true');

  const confirmRes = await request(app)
    .post('/api/ai/chat/confirm')
    .set('Authorization', `Bearer ${token}`)
    .send({ actionId, conversationId, locale: 'en' });

  if (confirmRes.status !== 200) {
    fail(`confirm after disambiguate → ${confirmRes.status}`);
    failed += 1;
  } else ok('confirm after disambiguate HTTP 200');

  const after = await countFoodLogs(prisma, user.id, foodAlt.id, grams);
  if (after !== before + 1) {
    fail(`FoodLog after disambiguate expected ${before + 1}, got ${after}`);
    failed += 1;
  } else ok('FoodLog row for disambiguated pick');

  if (await getPendingByActionId(user.id, actionId)) {
    fail('pending not cleared after disambiguate+confirm');
    failed += 1;
  } else ok('pending cleared after disambiguate+confirm');

  return failed;
}

async function scenarioConfirmDuringDisambiguation({ prisma, app, user, food, foodAlt, savePendingAction }) {
  let failed = 0;
  console.log('\n  [8] confirm during disambiguation does not write FoodLog');

  configureConfirmEnv();
  const grams = 204;
  const conversationId = `ci-e7-disambig-block-${Date.now()}`;
  const token = signToken(user);
  const before = await countFoodLogs(prisma, user.id, food.id, grams);

  const { actionId } = await savePendingAction({
    userId: user.id,
    conversationId,
    tools: ['log_food'],
    inputsByTool: { log_food: { rawText: `${grams}g chicken`, grams } },
    preview: 'Log food',
    intent: 'execute_action',
    userMessage: 'log chicken',
    locale: 'en',
    phase: 'disambiguation',
    disambiguation: {
      kind: 'food',
      query: 'chicken',
      grams,
      candidates: [
        { foodItemId: food.id, foodName: food.name, grams },
        { foodItemId: foodAlt.id, foodName: foodAlt.name, grams },
      ],
    },
  });

  const res = await request(app)
    .post('/api/ai/chat/confirm')
    .set('Authorization', `Bearer ${token}`)
    .send({ actionId, conversationId, locale: 'en' });

  if (res.status !== 200) {
    fail(`confirm during disambiguation → ${res.status}`);
    failed += 1;
  } else ok('confirm during disambiguation HTTP 200 (prompts pick)');

  if (!res.body?.disambiguationRequired) {
    fail('expected disambiguationRequired=true when confirming during disambiguation');
    failed += 1;
  } else ok('disambiguationRequired still true');

  const after = await countFoodLogs(prisma, user.id, food.id, grams);
  if (after !== before) {
    fail(`FoodLog written during disambiguation (${before} → ${after})`);
    failed += 1;
  } else ok('no FoodLog during disambiguation phase');

  return failed;
}

async function scenarioWebSocketConfirm({ prisma, user, food, savePendingAction, getPendingByActionId }) {
  let failed = 0;
  console.log('\n  [9] WebSocket coach.confirm → FoodLog');

  const http = require('http');
  const WebSocket = require('ws');
  const { attachWebSocketHub, shutdownWebSocketHub } = require('../src/realtime/wsHub');

  configureConfirmEnv();
  process.env.FEATURE_REALTIME_WS = 'true';

  const grams = 206;
  const conversationId = `ci-e7-ws-${Date.now()}`;
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
  const app = require('../src/app');
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

    if (!done.afterConfirm) {
      fail('coach.done missing afterConfirm');
      failed += 1;
    } else ok('coach.done afterConfirm=true');

    if (done.confirmationRequired !== false) {
      fail(`WS confirm expected confirmationRequired=false`);
      failed += 1;
    } else ok('WS confirmationRequired=false');

    const after = await countFoodLogs(prisma, user.id, food.id, grams);
    if (after !== before + 1) {
      fail(`FoodLog after WS confirm expected ${before + 1}, got ${after}`);
      failed += 1;
    } else ok('FoodLog row after WebSocket confirm');

    if (await getPendingByActionId(user.id, actionId)) {
      fail('pending not cleared after WS confirm');
      failed += 1;
    } else ok('pending cleared after WS confirm');

    ws.close();
  } finally {
    await shutdownWebSocketHub();
    await new Promise((resolve) => server.close(resolve));
  }

  return failed;
}

async function scenarioLiveFastApiChatConfirm({ prisma, user, food }) {
  let failed = 0;
  console.log('\n  [10] live FastAPI /chat → confirm → FoodLog');

  configureConfirmEnv();
  const app = require('../src/app');
  const aiPort = 9000 + (process.pid % 800);
  let nodeSrv = null;
  let aiProc = null;

  const grams = 205;
  const conversationId = `ci-e7-live-ai-${Date.now()}`;
  const before = await countFoodLogs(prisma, user.id, food.id, grams);
  const token = signToken(user);

  try {
    nodeSrv = await startNodeServer(app);
    const ai = startAiService({
      NODE_INTERNAL_API_URL: nodeSrv.baseUrl,
      AI_SERVICE_PORT: String(aiPort),
    });
    aiProc = ai.proc;
    await ai.waitReady();
    ok(`ai-service healthy ${ai.healthUrl}`);

    configureChatEnv(`http://127.0.0.1:${aiPort}`);

    const chatRes = await fetch(`${nodeSrv.baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: `log ${grams}g ${TEST_FOOD_NAME}` }],
        locale: 'en',
        conversationId,
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!chatRes.ok) {
      fail(`live POST /chat → ${chatRes.status} ${(await chatRes.text()).slice(0, 200)}`);
      return failed + 1;
    }
    const chatBody = await chatRes.json();
    ok('live POST /chat HTTP 200');

    if (!chatBody?.actionId) {
      fail(`live chat missing actionId: ${JSON.stringify(chatBody).slice(0, 200)}`);
      return failed + 1;
    }
    ok(`live chat actionId=${chatBody.actionId}`);

    if (!chatBody.confirmationRequired) {
      fail('live chat expected confirmationRequired=true');
      failed += 1;
    } else ok('live chat confirmationRequired=true');

    configureConfirmEnv();
    const confirmRes = await fetch(`${nodeSrv.baseUrl}/api/ai/chat/confirm`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        actionId: chatBody.actionId,
        conversationId,
        locale: 'en',
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!confirmRes.ok) {
      fail(`live confirm → ${confirmRes.status}`);
      failed += 1;
    } else ok('live confirm HTTP 200');

    const confirmBody = await confirmRes.json();
    if (confirmBody.confirmationRequired !== false) {
      fail('live confirm expected confirmationRequired=false');
      failed += 1;
    } else ok('live confirm confirmationRequired=false');

    const after = await countFoodLogs(prisma, user.id, food.id, grams);
    if (after !== before + 1) {
      fail(`FoodLog after live FastAPI expected ${before + 1}, got ${after}`);
      failed += 1;
    } else ok('FoodLog row after live FastAPI chat+confirm');
  } catch (err) {
    fail(`live FastAPI scenario: ${err.message}`);
    failed += 1;
  } finally {
    await stopProcess(aiProc);
    await stopNodeServer(nodeSrv?.server);
    configureConfirmEnv();
  }

  return failed;
}

async function dbIntegration() {
  let failed = 0;
  console.log('\n── DB integration (E7 confirm → FoodLog suite) ──\n');

  configureChatEnv();

  let chatViaFastApiStub = null;
  const chatStubHolder = {
    set(fn) {
      chatViaFastApiStub = fn;
    },
    clear() {
      chatViaFastApiStub = null;
    },
  };
  const aiFastApi = require('../src/services/aiFastApiClient');
  const originalChatViaFastApi = aiFastApi.chatViaFastApi;
  aiFastApi.chatViaFastApi = async (opts) => {
    if (chatViaFastApiStub) return chatViaFastApiStub(opts);
    return originalChatViaFastApi(opts);
  };

  configureConfirmEnv();

  const { prisma } = require('../src/db');
  const { savePendingAction, getPendingByActionId } = require('../src/services/pendingActionService');
  const { user, otherUser, food, foodAlt } = await ensureFixtures(prisma);
  ok(`fixtures user=${user.id} food=${food.id} alt=${foodAlt.id}`);

  const app = require('../src/app');

  const scenarios = [
    () =>
      scenarioDirectConfirm({ prisma, app, user, food, savePendingAction, getPendingByActionId }),
    () => scenarioChatTurnThenConfirm({ prisma, app, user, food }),
    () => scenarioHttpChatThenConfirm({ prisma, app, user, food, chatStubHolder }),
    () => scenarioCancelNoFoodLog({ prisma, app, user, food, savePendingAction, getPendingByActionId }),
    () => scenarioGuardrails({ app, user, otherUser, savePendingAction }),
    () => scenarioGetPending({ app, user, food, savePendingAction }),
    () =>
      scenarioDisambiguateThenConfirm({
        prisma,
        app,
        user,
        food,
        foodAlt,
        savePendingAction,
        getPendingByActionId,
      }),
    () =>
      scenarioConfirmDuringDisambiguation({
        prisma,
        app,
        user,
        food,
        foodAlt,
        savePendingAction,
      }),
    () =>
      scenarioWebSocketConfirm({
        prisma,
        user,
        food,
        savePendingAction,
        getPendingByActionId,
      }),
    ...(LIVE_FASTAPI
      ? [() => scenarioLiveFastApiChatConfirm({ prisma, user, food })]
      : []),
  ];

  for (const run of scenarios) {
    try {
      failed += await run();
    } catch (err) {
      fail(`scenario threw: ${err.message}`);
      failed += 1;
    }
  }

  return failed;
}

async function main() {
  let failed = staticChecks();

  if (DB) {
    if (!process.env.DATABASE_URL) {
      console.log('\nSKIP db — DATABASE_URL not set');
    } else {
      try {
        failed += await dbIntegration();
      } catch (err) {
        console.log(`FAIL db suite: ${err.message}`);
        failed += 1;
      } finally {
        await require('../src/db').prisma.$disconnect().catch(() => {});
      }
    }
  } else {
    console.log('\n(tip: npm run verify:e7-confirm-food -- --db)');
    console.log('     npm run verify:e7-confirm-food:db -- --live-fastapi  # + real ai-service');
  }

  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log('\nE7 confirm→FoodLog verify PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
