/* eslint-disable no-console */
/**
 * Pre-E gate — coach semantics, env checklist, optional live probes.
 *
 *   npm run verify:pre-e
 *   npm run verify:pre-e -- --live   # also probe :4002 and :8000 /health
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  quickClassifyMessage,
  semanticHints,
  isCoachScopeMessage,
} = require('../src/lib/coach/messageSemantics');
const { checkOffTopic } = require('../src/lib/coach/offTopicGuard');

const LIVE = process.argv.includes('--live');

const IN_DOMAIN_CASES = [
  { msg: 'من هي تكوين؟', hint: 'platform' },
  { msg: 'ما هي ميزات تطبيق تكوين', hint: 'platform' },
  { msg: 'ابعثلي اخر رساله انت بعتها', hint: 'chat_memory' },
  { msg: 'مين انت وبتعمل ايه', hint: 'coach' },
  { msg: 'عايز اعرف نوع جسمي', hint: 'body_type' },
  { msg: 'what is Taqwin app', hint: 'platform' },
  { msg: 'what should I eat today', hint: 'fitness' },
  { msg: 'ازاي اسجل اكل في التطبيق', hint: 'platform' },
];

const HARD_BLOCK_CASES = [
  'write me a python function for sorting',
  'what is the weather tomorrow',
  'should I buy bitcoin today',
];

function fail(msg) {
  console.error(`✗ ${msg}`);
  return false;
}

function ok(msg) {
  console.log(`✓ ${msg}`);
  return true;
}

async function checkSemantics() {
  console.log('── Coach semantics (off-topic guard) ──\n');
  let passed = true;

  for (const { msg, hint } of IN_DOMAIN_CASES) {
    if (quickClassifyMessage(msg) !== 'in-domain') {
      passed = fail(`Expected in-domain: "${msg}"`) && passed;
      continue;
    }
    const hints = semanticHints(msg);
    if (hint === 'body_type') {
      if (!hints.includes('body_type')) {
        passed = fail(`Missing body_type hint: "${msg}"`) && passed;
      } else {
        ok(`in-domain + body_type: ${msg.slice(0, 48)}…`);
      }
    } else if (!hints.includes(hint)) {
      passed = fail(`Missing hint "${hint}" for: "${msg}" (got ${hints.join(',')})`) && passed;
    } else {
      ok(`in-domain + ${hint}: ${msg.slice(0, 48)}${msg.length > 48 ? '…' : ''}`);
    }

    const guard = await checkOffTopic(msg);
    if (!guard.inDomain || guard.offTopicReply) {
      passed = fail(`checkOffTopic blocked: "${msg}" (${guard.reason})`) && passed;
    }
  }

  for (const msg of HARD_BLOCK_CASES) {
    if (!isCoachScopeMessage(msg)) {
      ok(`hard-block: ${msg.slice(0, 40)}…`);
      const guard = await checkOffTopic(msg, { locale: 'en' });
      if (!guard.inDomain && guard.offTopicReply) {
        ok(`redirect returned for hard-block`);
      } else {
        passed = fail(`Expected redirect for: "${msg}"`) && passed;
      }
    } else {
      passed = fail(`Should be hard-blocked: "${msg}"`) && passed;
    }
  }

  console.log('');
  return passed;
}

function checkL1SourcesOnDisk() {
  console.log('── L1 knowledge files on disk ──\n');
  const l1Dir = path.join(__dirname, '..', 'data', 'knowledge', 'l1');
  const required = [
    'ai-coach-behavior.md',
    'athlete-platform-faq.md',
    'athlete-features-ar.md',
    'platform-overview.md',
    'onboarding-and-plans.md',
  ];
  let passed = true;
  for (const name of required) {
    const p = path.join(l1Dir, name);
    if (!fs.existsSync(p)) {
      passed = fail(`Missing ${name}`) && passed;
    } else {
      ok(name);
    }
  }
  console.log('');
  return passed;
}

function checkEnvChecklist() {
  console.log('── Environment checklist (Pre-E / FastAPI bridge) ──\n');
  let passed = true;
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const mongoOk = (process.env.MONGO_URI || process.env.MONGODB_URI || '').trim();
  const recommended = [
    'FEATURE_AI_VIA_FASTAPI',
    'AI_SERVICE_URL',
    'AI_INTERNAL_KEY',
  ];
  const llmAny = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OLLAMA_BASE_URL'];
  const embedAny = ['OPENAI_API_KEY', 'VOYAGE_API_KEY'];

  for (const key of required) {
    if (!(process.env[key] || '').trim()) {
      passed = fail(`Missing required: ${key}`) && passed;
    } else {
      ok(`${key} set`);
    }
  }

  if (mongoOk) {
    ok('MONGO_URI or MONGODB_URI set');
  } else {
    console.log('  ⚠ MONGO_URI / MONGODB_URI not set (chat memory + plans need Mongo)');
  }

  for (const key of recommended) {
    if (!(process.env[key] || '').trim()) {
      console.log(`  ⚠ ${key} not set (recommended for production-like dev)`);
    } else {
      ok(`${key} set`);
    }
  }

  const fastApi = (process.env.FEATURE_AI_VIA_FASTAPI || '').toLowerCase();
  if (fastApi === 'true' || fastApi === '1') {
    ok('FEATURE_AI_VIA_FASTAPI enabled');
    if (!(process.env.AI_SERVICE_URL || '').trim()) {
      passed = fail('FEATURE_AI_VIA_FASTAPI=true but AI_SERVICE_URL missing') && passed;
    }
  } else {
    console.log('  ⚠ FEATURE_AI_VIA_FASTAPI not true — chat uses Node LLM path only');
  }

  if (llmAny.some((k) => (process.env[k] || '').trim())) {
    ok('LLM provider configured');
  } else {
    console.log('  ⚠ No ANTHROPIC/GEMINI/OLLAMA — chat replies may fail');
  }

  if (embedAny.some((k) => (process.env[k] || '').trim())) {
    ok('Embedding provider configured (RAG)');
  } else {
    console.log('  ⚠ No OPENAI/VOYAGE — run rag:ingest with --skip-embed or set keys');
  }

  console.log('');
  return passed;
}

async function probeHealth(url, label) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      console.log(`  ⚠ ${label}: HTTP ${res.status} (${url})`);
      return false;
    }
    const body = await res.json().catch(() => ({}));
    ok(`${label} reachable — ${body.status || body.service || 'ok'}`);
    return true;
  } catch (err) {
    console.log(`  ⚠ ${label} not reachable (${url}) — start server for --live`);
    return false;
  }
}

async function checkLive() {
  console.log('── Live health probes (--live) ──\n');
  const port = process.env.PORT || '4002';
  await probeHealth(`http://127.0.0.1:${port}/health`, 'backend-node');
  await probeHealth('http://127.0.0.1:8000/health', 'ai-service');
  console.log('');
  return true;
}

async function main() {
  console.log('Pre-E — Coach & platform readiness gate\n');

  let okAll = true;
  okAll = (await checkSemantics()) && okAll;
  okAll = checkL1SourcesOnDisk() && okAll;
  okAll = checkEnvChecklist() && okAll;

  if (LIVE) {
    await checkLive();
  } else {
    console.log('Tip: npm run verify:pre-e -- --live  (probes /health when servers run)\n');
  }

  if (!okAll) {
    console.error('Pre-E verify FAILED — fix items above before Block C.');
    process.exit(1);
  }

  console.log('Pre-E verify PASSED (semantics + sources + env).');
  console.log('Next: npm run verify:pre-e:blocks  (full a0–b8 chain when DB/API keys ready)');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
