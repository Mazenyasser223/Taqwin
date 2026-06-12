/* eslint-disable no-console */
/**
 * Run Pre-E infrastructure + RAG verify chain (skips a5 unless A5_VERIFY_USER_ID set).
 *
 *   npm run verify:pre-e:blocks
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

const steps = [
  ['verify:pre-e', []],
  ['verify:tool-registry', []],
  ['verify:plan-prompt-contract', []],
  ['test', ['tests/messageSemantics.test.js', 'tests/pendingAction.test.js', 'tests/cagSanitize.test.js', 'tests/contextBundle.test.js']],
  ['verify:cag-sanitize', []],
  ['verify:a0', []],
  ['verify:a1', []],
  ['verify:b1', []],
  ['verify:b2', []],
  ['verify:b3', []],
  ['verify:b4', []],
  ['verify:b5', []],
  ['verify:b8', []],
  ['verify:b6', []],
  ['verify:b7', []],
];

function runNpm(script, extraArgs = []) {
  console.log(`\n▶ npm run ${script}${extraArgs.length ? ` -- ${extraArgs.join(' ')}` : ''}\n`);
  const r = spawnSync('npm', ['run', script, ...(extraArgs.length ? ['--', ...extraArgs] : [])], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  return r.status === 0;
}

async function main() {
  console.log('Pre-E block chain — backend-node\n');

  for (const [script, args] of steps) {
    if (!runNpm(script, args)) {
      console.error(`\n✗ Failed at: npm run ${script}`);
      process.exit(1);
    }
  }

  const userId = process.env.A5_VERIFY_USER_ID;
  if (userId) {
    if (!runNpm('verify:a5', [`--user-id=${userId}`])) {
      console.error('\n✗ Failed at: verify:a5');
      process.exit(1);
    }
  } else {
    console.log('\n⚠ Skipping verify:a5 — set A5_VERIFY_USER_ID in .env to include CAG user probe\n');
  }

  console.log('\n✓ Pre-E block chain passed (backend + FastAPI b6/b7).');
  console.log('Optional: cd ../ai-service && pytest  (full ai-service unit tests)');
  process.exit(0);
}

main();
