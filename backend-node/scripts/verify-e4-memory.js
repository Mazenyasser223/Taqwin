/* eslint-disable no-console */
/**
 * Block E4 — AI memory pipeline verification (session trigger + nightly worker).
 *
 *   npm run verify:e4-memory
 *   npm run verify:e4-memory -- --live    # Redis ping + enqueue smoke job
 *   npm run verify:e4-memory -- --strict  # fail if prod env vars missing
 */
require('dotenv').config({ override: true });

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src');
const LIVE = process.argv.includes('--live');
const STRICT = process.argv.includes('--strict');

function read(rel) {
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

const staticChecks = [
  {
    name: 'queues.js defines ai-memory-summarize queue',
    ok: () => read('jobs/queues.js').includes("'ai-memory-summarize'"),
  },
  {
    name: 'aiMemoryJobs exports enqueueAiMemorySummarize with source',
    ok: () =>
      read('jobs/aiMemoryJobs.js').includes('enqueueAiMemorySummarize') &&
      read('jobs/aiMemoryJobs.js').includes('session_chat'),
  },
  {
    name: 'aiMemoryWorker calls summarizeUserMemories',
    ok: () => read('jobs/workers/aiMemoryWorker.js').includes('summarizeUserMemories'),
  },
  {
    name: 'worker.js starts ai-memory worker + scheduler',
    ok: () =>
      read('worker.js').includes('startAiMemoryWorker') &&
      read('worker.js').includes('startMemorySummarizeScheduler'),
  },
  {
    name: 'index.js can start ai-memory worker (inline dev mode)',
    ok: () => read('index.js').includes('startAiMemoryWorker'),
  },
  {
    name: 'chatMemory appendTurn hooks memorySessionTrigger',
    ok: () =>
      read('lib/chatMemory.js').includes('memorySessionTrigger') &&
      read('lib/chatMemory.js').includes('maybeEnqueueMemoryAfterSession'),
  },
  {
    name: 'memorySessionTrigger gates on isPlanQueueEnabled + mongo',
    ok: () =>
      read('lib/ai/memorySessionTrigger.js').includes('isPlanQueueEnabled') &&
      read('lib/ai/memorySessionTrigger.js').includes('isMongoConfigured'),
  },
  {
    name: 'memoryPipeline uses unified MEMORY_SOURCES',
    ok: () =>
      read('lib/ai/memoryPipeline.js').includes('MEMORY_SOURCES.SESSION_CHAT') &&
      read('lib/ai/memoryPipeline.js').includes('MEMORY_SOURCES.TOOL_SUCCESS'),
  },
  {
    name: 'memoryPipeline calls FastAPI (not Node LLM)',
    ok: () =>
      read('lib/ai/memoryPipeline.js').includes('memorySummarizeViaFastApi') &&
      !read('lib/ai/memoryPipeline.js').includes('aiChatProvider'),
  },
  {
    name: 'contextBundle prioritizes aiMemories',
    ok: () =>
      read('lib/contextBundle.js').includes('prioritizeAiMemories') &&
      read('lib/contextBundle.js').includes('aiMemories'),
  },
  {
    name: 'memoryEvents.js unified enqueue (session + tool + nightly)',
    ok: () =>
      read('lib/ai/memoryEvents.js').includes('enqueueMemorySummarize') &&
      read('lib/ai/memoryEvents.js').includes('enqueueMemoryAfterTool') &&
      read('lib/ai/memoryEvents.js').includes('MEMORY_SOURCES'),
  },
  {
    name: 'no direct tool memory writes (maybeRememberToolSuccess removed)',
    ok: () =>
      !read('services/aiMemoryService.js').includes('maybeRememberToolSuccess') &&
      !read('services/aiMemoryService.js').includes('last_'),
  },
  {
    name: 'aiToolExecutor enqueues memory events only',
    ok: () =>
      read('services/aiToolExecutor.js').includes('enqueueMemoryAfterTool') &&
      !read('services/aiToolExecutor.js').includes('maybeRememberToolSuccess'),
  },
  {
    name: 'upsertAiMemory enforces semantic key schema',
    ok: () =>
      read('services/aiMemoryService.js').includes('isSemanticMemoryKey') &&
      read('lib/ai/aiMemoryKeys.js').includes('isSemanticMemoryKey'),
  },
  {
    name: 'memoryPipeline logs observability fields',
    ok: () =>
      read('lib/ai/memoryPipeline.js').includes('keysWritten') &&
      read('lib/ai/memoryPipeline.js').includes('latencyMs'),
  },
  {
    name: 'package.json has worker script',
    ok: () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
      return Boolean(pkg.scripts?.worker);
    },
  },
];

function checkEnvReadiness() {
  console.log('\n── Environment readiness ──\n');
  let failed = 0;

  const {
    isBullMqConfigured,
    isPlanQueueFeatureEnabled,
    isPlanQueueEnabled,
  } = require('../src/lib/redisBull');
  const { isMongoConfigured } = require('../src/db/mongo/client');
  const {
    isSessionMemoryTriggerEnabled,
    getSessionMinTurns,
  } = require('../src/lib/ai/memorySessionTrigger');
  const { isMemorySchedulerEnabled } = require('../src/jobs/schedulers/memorySummarizeScheduler');

  const redisTcp = isBullMqConfigured();
  const planQueueFlag = isPlanQueueFeatureEnabled();
  const queueEnabled = isPlanQueueEnabled();
  const mongo = isMongoConfigured();
  const sessionTrigger = isSessionMemoryTriggerEnabled();
  const memoryCron = isMemorySchedulerEnabled();
  const nodeEnv = process.env.NODE_ENV || 'development';

  console.log(`  NODE_ENV:                    ${nodeEnv}`);
  console.log(`  REDIS_URL (TCP/BullMQ):      ${redisTcp ? 'set' : 'MISSING'}`);
  console.log(`  FEATURE_PLAN_QUEUE:          ${planQueueFlag ? 'on' : 'off'}`);
  console.log(`  isPlanQueueEnabled():        ${queueEnabled ? 'true' : 'false'}`);
  console.log(`  MONGO_URI:                   ${mongo ? 'set' : 'MISSING'}`);
  console.log(`  FEATURE_AI_MEMORY_SESSION:   ${sessionTrigger ? 'on (default)' : 'off'}`);
  console.log(`  AI_MEMORY_SESSION_MIN_TURNS: ${getSessionMinTurns()}`);
  console.log(`  FEATURE_AI_MEMORY_CRON:      ${memoryCron ? 'on' : 'off'}`);

  if (!redisTcp) {
    failed += fail('REDIS_URL required for BullMQ (session trigger + nightly batch)') ? 1 : 0;
  } else {
    ok('REDIS_URL configured');
  }

  if (!planQueueFlag) {
    failed += fail('FEATURE_PLAN_QUEUE must be true for memory jobs to enqueue') ? 1 : 0;
  } else {
    ok('FEATURE_PLAN_QUEUE enabled');
  }

  if (!mongo) {
    failed += fail('MONGO_URI required for chat persistence + memory summarization input') ? 1 : 0;
  } else {
    ok('MONGO_URI configured');
  }

  if (STRICT || nodeEnv === 'production') {
    if (!queueEnabled) {
      failed += fail('Production requires isPlanQueueEnabled() === true') ? 1 : 0;
    }
    if (!mongo) {
      failed += fail('Production requires Mongo for chat → memory pipeline') ? 1 : 0;
    }
  } else if (!queueEnabled || !mongo) {
    console.log('\n  (dev note: session memory trigger will no-op until queue + mongo are set)');
  }

  return failed;
}

async function liveSmoke() {
  console.log('\n── Live smoke (Redis + queue) ──\n');

  const { isPlanQueueEnabled } = require('../src/lib/redisBull');
  const { getAiMemorySummarizeQueue, closeQueues } = require('../src/jobs/queues');
  const { createBullConnection, closeBullConnection } = require('../src/lib/redisBull');
  const { isMongoConfigured, connectMongo, disconnectMongo } = require('../src/db/mongo/client');
  const { pingRedis } = require('../src/lib/redis');

  if (!isPlanQueueEnabled()) {
    throw new Error('isPlanQueueEnabled() is false — set FEATURE_PLAN_QUEUE=true and REDIS_URL');
  }

  const probe = createBullConnection();
  try {
    await Promise.race([
      probe.ping(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Redis ping timeout (10s)')),
          Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 10000)
        )
      ),
    ]);
    ok('BullMQ Redis TCP ping');
  } finally {
    await probe.quit().catch(() => probe.disconnect());
  }

  const cachePing = await pingRedis();
  if (cachePing) {
    ok('General Redis cache ping (milestone dedupe)');
  } else {
    console.log('WARN Redis cache not reachable — milestone dedupe may not persist (Upstash REST ok)');
  }

  if (isMongoConfigured()) {
    await connectMongo();
    ok('MongoDB connect');
    await disconnectMongo().catch(() => null);
  } else {
    throw new Error('MONGO_URI not set — cannot verify chat persistence');
  }

  const queue = getAiMemorySummarizeQueue();
  if (!queue) throw new Error('getAiMemorySummarizeQueue returned null');

  const testUserId = '00000000-0000-4000-8000-000000000001';
  const jobId = `ai-memory-${testUserId}-verify-e4`;
  const job = await queue.add(
    'summarize',
    {
      userId: testUserId,
      locale: 'ar',
      hours: 24,
      dryRun: true,
      source: 'session_chat',
      enqueuedAt: new Date().toISOString(),
    },
    { jobId }
  );
  const state = await job.getState();
  ok(`enqueue ai-memory-summarize jobId=${job.id} state=${state} dryRun=true`);
  await job.remove().catch(() => {});
  await closeQueues();
  await closeBullConnection();
}

async function main() {
  console.log('Block E4 — AI memory pipeline verify\n');

  let failed = 0;
  for (const c of staticChecks) {
    if (c.ok()) {
      console.log(`OK  ${c.name}`);
    } else {
      console.log(`FAIL ${c.name}`);
      failed += 1;
    }
  }

  failed += checkEnvReadiness();

  if (LIVE) {
    try {
      await liveSmoke();
    } catch (err) {
      fail(`live smoke: ${err.message}`);
      failed += 1;
    }
  } else {
    console.log('\n(tip: npm run verify:e4-memory -- --live for Redis/Mongo/queue smoke)');
  }

  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log('\nE4 memory verify PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
