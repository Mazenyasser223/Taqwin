/* eslint-disable no-console */
/**
 * Block C3 verification — BullMQ plan:generate worker wiring.
 *
 *   node scripts/verify-c3.js
 *   node scripts/verify-c3.js --redis   # enqueue smoke job (needs REDIS_URL + worker or inline)
 */
require('dotenv').config({ override: true });

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const staticChecks = [
  {
    name: 'redisBull.js exports isPlanQueueEnabled',
    ok: () => read('lib/redisBull.js').includes('isPlanQueueEnabled'),
  },
  {
    name: 'queues.js defines plan:generate',
    ok: () => read('jobs/queues.js').includes("'plan-generate'"),
  },
  {
    name: 'planGenerateWorker calls generatePlanForUser',
    ok: () => read('jobs/workers/planGenerateWorker.js').includes('generatePlanForUser'),
  },
  {
    name: 'worker.js entry exists',
    ok: () => fs.existsSync(path.join(root, 'worker.js')),
  },
  {
    name: 'plan routes enqueue when queue enabled',
    ok: () =>
      read('routes/ai/plan.js').includes('enqueuePlanGenerate') &&
      read('routes/ai/plan.js').includes("status(202)"),
  },
  {
    name: 'package.json has worker script',
    ok: () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
      return Boolean(pkg.scripts?.worker);
    },
  },
];

async function redisSmoke() {
  const { isPlanQueueEnabled } = require('../src/jobs/planGenerateJobs');
  const { getPlanGenerateQueue, closeQueues } = require('../src/jobs/queues');
  const { createBullConnection, closeBullConnection } = require('../src/lib/redisBull');

  if (!isPlanQueueEnabled()) {
    console.log('SKIP redis smoke — set FEATURE_PLAN_QUEUE=true and REDIS_URL');
    return;
  }

  const probe = createBullConnection();
  try {
    await Promise.race([
      probe.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis ping timeout (2s)')), 2000)),
    ]);
  } catch (err) {
    await probe.quit().catch(() => probe.disconnect());
    throw new Error(`Redis not reachable at ${process.env.REDIS_URL}: ${err.message}`);
  }
  await probe.quit().catch(() => probe.disconnect());

  const queue = getPlanGenerateQueue();
  const testUserId = `verify-c3-${Date.now()}`;
  const job = await queue.add(
    'generate',
    {
      userId: testUserId,
      locale: 'ar',
      regenerationReason: 'verify-c3-smoke',
      source: 'verify',
      enqueuedAt: new Date().toISOString(),
    },
    { jobId: `plan-generate-${testUserId}` }
  );
  const state = await job.getState();
  console.log(`OK  redis enqueue jobId=${job.id} state=${state}`);
  await job.remove().catch(() => {});
  await closeQueues();
  await closeBullConnection();
}

async function main() {
  let failed = 0;
  console.log('Block C3 verify\n');

  for (const c of staticChecks) {
    if (c.ok()) {
      console.log(`OK  ${c.name}`);
    } else {
      console.log(`FAIL ${c.name}`);
      failed += 1;
    }
  }

  if (process.argv.includes('--redis')) {
    console.log('\n-- Redis smoke --');
    try {
      await redisSmoke();
    } catch (err) {
      console.log('FAIL redis smoke:', err.message);
      failed += 1;
    }
  } else {
    console.log('\n(tip: node scripts/verify-c3.js --redis for enqueue smoke)');
  }

  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log('\nC3 verify PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
