#!/usr/bin/env node
/**
 * Block E7 — AI E2E checklist (env + optional live probes).
 *   npm run verify:e2e-ai
 *   npm run verify:e2e-ai -- --live
 */
/* eslint-disable no-console */
require('dotenv').config({ override: true });

const LIVE = process.argv.includes('--live');
const { looksLikeChatAction } = require('../src/lib/coach/coachSemantics');
const { listStubTools } = require('../src/services/aiToolExecutor');
const { isFastApiBridgeEnabled, pingFastApiHealth } = require('../src/services/aiFastApiClient');

const CASES = [
  { msg: 'log 200g chicken for lunch', action: true, tool: 'log_food' },
  { msg: 'replace bench press with dumbbell press', action: true, tool: 'replace' },
  { msg: 'set travel mode this week', action: true, tool: 'life' },
  { msg: 'simplify my plan', action: true, tool: 'adapt' },
  { msg: 'what is high protein breakfast', action: false },
  { msg: 'بدّلي تمرين النهارده', action: true, tool: 'replace' },
];

function ok(m) {
  console.log(`✓ ${m}`);
  return true;
}
function fail(m) {
  console.error(`✗ ${m}`);
  return false;
}

async function main() {
  let passed = true;
  console.log('── AI E2E checklist ──\n');

  const tools = listStubTools();
  for (const required of [
    'log_food',
    'replace_exercise_today',
    'get_workout_today',
    'set_life_mode',
    'adapt_plan',
  ]) {
    if (!tools.includes(required)) passed = fail(`Missing tool handler: ${required}`) && passed;
    else ok(`tool handler: ${required}`);
  }

  for (const c of CASES) {
    const isAction = looksLikeChatAction(c.msg);
    if (isAction !== c.action) {
      passed = fail(`Action detect mismatch: "${c.msg}" expected ${c.action}`) && passed;
    } else {
      ok(`action detect: ${c.msg.slice(0, 40)}`);
    }
  }

  if (isFastApiBridgeEnabled()) ok('FEATURE_AI_VIA_FASTAPI + AI_SERVICE_URL enabled');
  else {
    passed = fail('FEATURE_AI_VIA_FASTAPI + AI_SERVICE_URL required for chat') && passed;
  }

  if (LIVE && isFastApiBridgeEnabled()) {
    const healthy = await pingFastApiHealth();
    if (healthy) ok('ai-service /health OK');
    else passed = fail('ai-service /health failed') && passed;
  }

  console.log(passed ? '\n✓ AI E2E checklist passed' : '\n✗ AI E2E checklist failed');
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
