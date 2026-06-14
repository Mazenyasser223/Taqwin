/* eslint-disable no-console */
/**
 * Production readiness — env, storage split, pgvector, optional remote /health.
 *
 *   node scripts/verify-production-readiness.js
 *   node scripts/verify-production-readiness.js --url https://api.taqwin.com/health
 *   node scripts/verify-production-readiness.js --url https://taqwin.onrender.com/health
 */
require('dotenv').config({ override: true });
const { spawnSync } = require('child_process');
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';
const urlArg = process.argv.find((a) => a.startsWith('--url='))?.slice(6)
  || (process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : null);

const REQUIRED_PROD = [
  'DATABASE_URL',
  'JWT_SECRET',
  'FRONTEND_URL',
  'MONGO_URI',
  'REDIS_URL',
];

const RECOMMENDED_PROD = [
  'ANTHROPIC_API_KEY',
  'AI_INTERNAL_KEY',
  'OPENAI_API_KEY',
  'SUPABASE_SERVICE_KEY',
  'AI_SERVICE_URL',
];

function ok(msg) {
  console.log(`OK  ${msg}`);
  return true;
}

function warn(msg) {
  console.warn(`WARN ${msg}`);
  return false;
}

function fail(msg) {
  console.error(`FAIL ${msg}`);
  return false;
}

function runScript(name) {
  const scriptPath = path.join(__dirname, name);
  const r = spawnSync(process.execPath, [scriptPath], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    env: process.env,
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r.status === 0;
}

async function probeHealth(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      fail(`${url} → HTTP ${res.status}`);
      return false;
    }
    ok(`${url} → status=${body.status}, database=${body.database}`);
    if (body.features) {
      console.log('    features:', JSON.stringify(body.features));
    }
    if (body.websocket) {
      console.log('    websocket:', JSON.stringify(body.websocket));
    }
    if (body.stores?.pgvector) {
      console.log('    pgvector:', JSON.stringify(body.stores.pgvector));
    }
    if (body.status === 'degraded') {
      warn('Remote health is degraded — check stores in response');
    }
    return body.status === 'ok' || body.status === 'degraded';
  } catch (err) {
    fail(`${url} unreachable: ${err.message}`);
    return false;
  }
}

function hasMongoUri() {
  return Boolean(process.env.MONGO_URI?.trim() || process.env.MONGODB_URI?.trim());
}

async function main() {
  console.log('Taqwin production readiness\n');
  let passed = true;

  if (isProd) ok('NODE_ENV=production');
  else warn('NODE_ENV is not production (OK for local dry-run)');

  for (const key of REQUIRED_PROD) {
    if (key === 'MONGO_URI') {
      if (hasMongoUri()) ok('env MONGO_URI (or MONGODB_URI) set');
      else passed = fail('env MONGO_URI missing') && passed;
      continue;
    }
    if (process.env[key]?.trim()) ok(`env ${key} set`);
    else passed = fail(`env ${key} missing`) && passed;
  }

  for (const key of RECOMMENDED_PROD) {
    if (!process.env[key]?.trim()) warn(`env ${key} not set (recommended for full AI + uploads)`);
  }

  const wsFlag = (process.env.FEATURE_REALTIME_WS || 'true').toLowerCase();
  if (wsFlag === 'false' || wsFlag === '0') {
    passed = fail('FEATURE_REALTIME_WS=false — coach chat streaming disabled in UI') && passed;
  } else {
    ok('FEATURE_REALTIME_WS enabled (coach streams over /ws)');
  }

  if (process.env.FEATURE_AI_VIA_FASTAPI === 'true' && !process.env.AI_SERVICE_URL?.trim()) {
    passed = fail('FEATURE_AI_VIA_FASTAPI=true requires AI_SERVICE_URL') && passed;
  }

  if (process.env.FEATURE_PLAN_QUEUE === 'true' && !process.env.REDIS_URL?.trim()) {
    passed = fail('FEATURE_PLAN_QUEUE=true requires REDIS_URL (TCP)') && passed;
  } else if (process.env.FEATURE_PLAN_QUEUE === 'true') {
    ok('Plan queue enabled with REDIS_URL');
  } else {
    warn('FEATURE_PLAN_QUEUE not true — async plan jobs disabled');
  }

  if (process.env.NODE_ENV === 'production' && process.env.MONGO_VECTOR_SEARCH === 'true') {
    warn('MONGO_VECTOR_SEARCH=true in production — prefer RAG_PREFER_PGVECTOR=true instead');
  } else {
    ok('RAG policy: pgvector preferred in production');
  }

  console.log('\nCAG bundle verify:');
  const a5User = process.env.A5_VERIFY_USER_ID?.trim();
  if (a5User) {
    const r = spawnSync(
      process.execPath,
      [path.join(__dirname, 'verify-a5-cag.js'), `--user-id=${a5User}`],
      { cwd: path.join(__dirname, '..'), encoding: 'utf8', env: process.env }
    );
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    if (r.status !== 0) passed = false;
  } else {
    warn('A5_VERIFY_USER_ID not set — skip CAG verify (set athlete UUID for full check)');
  }

  console.log('\nCoach streaming / WebSocket verify:');
  if (!runScript('verify-ws-streaming.js')) passed = false;

  console.log('\nE7 confirm→FoodLog wiring:');
  if (!runScript('verify-e7-confirm-food.js')) passed = false;

  console.log('\nStorage split verify:');
  if (!runScript('verify-storage-split.js')) passed = false;

  if (process.env.DATABASE_URL) {
    console.log('\npgvector verify:');
    if (!runScript('verify-b1-pgvector.js')) {
      warn('pgvector not ready — enable extension + npm run db:migrate + rag:ingest:*');
    }
  }

  if (urlArg) {
    console.log('\nRemote health probe:');
    const remoteOk = await probeHealth(urlArg);
    if (!remoteOk) passed = false;
  } else {
    console.log('\nTip: add --url https://api.taqwin.com/health to probe live deployment');
  }

  console.log(passed ? '\nProduction readiness PASSED' : '\nProduction readiness FAILED');
  if (!passed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
