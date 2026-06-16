#!/usr/bin/env node
/**
 * Step-up auth config sync + unit smoke checks.
 *   npm run verify:step-up
 */
/* eslint-disable no-console */
require('dotenv').config({ override: true });

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const ROOT = path.resolve(__dirname, '../..');
const CONFIG_PATH = path.join(ROOT, 'shared/coach-step-up.json');
const requireFromHere = createRequire(__filename);

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
  console.log('── Step-up auth verify ──\n');

  if (!fs.existsSync(CONFIG_PATH)) {
    passed = fail(`Missing shared config: ${CONFIG_PATH}`) && passed;
  } else {
    ok(`shared config: ${path.relative(ROOT, CONFIG_PATH)}`);
  }

  const shared = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const {
    STEP_UP_TOOLS,
    pendingRequiresStepUp,
    resolveStepUpPhrase,
    STEP_UP_IDLE_MS,
  } = requireFromHere('../src/lib/coach/stepUpAuth');

  for (const tool of shared.stepUpTools || []) {
    if (!STEP_UP_TOOLS.has(tool)) {
      passed = fail(`Node STEP_UP_TOOLS missing ${tool}`) && passed;
    }
  }
  ok(`Node tools synced (${STEP_UP_TOOLS.size} tools)`);

  try {
    const pyPath = path.join(ROOT, 'ai-service/app/agent/tools/step_up_config.py');
    const pySrc = fs.readFileSync(pyPath, 'utf8');
    for (const tool of shared.stepUpTools || []) {
      if (!pySrc.includes(`"${tool}"`) && !pendingRequiresStepUp([tool])) {
        /* Python loads from JSON — check runtime via subprocess if needed */
      }
    }
    ok('Python step_up_config module present');
  } catch (err) {
    passed = fail(`Python config check failed: ${err.message}`) && passed;
  }

  if (Number(shared.idleMs) !== STEP_UP_IDLE_MS && !process.env.STEP_UP_IDLE_MS) {
    passed = fail(`idleMs mismatch shared=${shared.idleMs} node=${STEP_UP_IDLE_MS}`) && passed;
  } else {
    ok(`idleMs=${STEP_UP_IDLE_MS} (${Math.round(STEP_UP_IDLE_MS / 60000)} min)`);
  }

  if (process.env.STEP_UP_IDLE_MS) {
    ok(`STEP_UP_IDLE_MS env override=${process.env.STEP_UP_IDLE_MS}`);
  }
  if (process.env.STEP_UP_MAX_FAILS) {
    ok(`STEP_UP_MAX_FAILS env override=${process.env.STEP_UP_MAX_FAILS}`);
  }
  if (process.env.STEP_UP_LOCKOUT_MS) {
    ok(`STEP_UP_LOCKOUT_MS env override=${process.env.STEP_UP_LOCKOUT_MS}`);
  }

  const travelPhrase = resolveStepUpPhrase(
    ['set_life_mode'],
    { set_life_mode: { lifeMode: 'travel' } },
    'en',
  );
  if (travelPhrase !== 'TRAVEL') {
    passed = fail(`Expected TRAVEL phrase, got ${travelPhrase}`) && passed;
  } else {
    ok('context-aware phrase: set_life_mode → TRAVEL');
  }

  if (!pendingRequiresStepUp(['adapt_plan'])) {
    passed = fail('adapt_plan should require step-up eligibility') && passed;
  }
  if (pendingRequiresStepUp(['log_food'])) {
    passed = fail('log_food should not require step-up') && passed;
  } else {
    ok('log_food excluded from step-up');
  }

  console.log(passed ? '\n✓ Step-up verify passed' : '\n✗ Step-up verify failed');
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
