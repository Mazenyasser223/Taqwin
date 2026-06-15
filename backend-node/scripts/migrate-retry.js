#!/usr/bin/env node
/**
 * Retry prisma migrate deploy when Supabase pool is saturated or briefly unreachable.
 *
 *   node scripts/migrate-retry.js
 *   node scripts/migrate-retry.js --attempts 5 --delay 20
 */
require('dotenv').config({ override: true });

const { spawnSync } = require('node:child_process');

const args = process.argv.slice(2);
const attemptsArg = args.find((a) => a.startsWith('--attempts='));
const delayArg = args.find((a) => a.startsWith('--delay='));
const attempts = attemptsArg ? Number(attemptsArg.split('=')[1]) : 5;
const delaySec = delayArg ? Number(delayArg.split('=')[1]) : 15;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  for (let i = 1; i <= attempts; i += 1) {
    console.log(`[migrate-retry] attempt ${i}/${attempts}…`);
    const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
      stdio: 'inherit',
      shell: true,
      cwd: require('node:path').join(__dirname, '..'),
    });
    if (result.status === 0) {
      console.log('[migrate-retry] success');
      const gen = spawnSync('npx', ['prisma', 'generate'], {
        stdio: 'inherit',
        shell: true,
        cwd: require('node:path').join(__dirname, '..'),
      });
      process.exit(gen.status === 0 ? 0 : 1);
    }
    if (i < attempts) {
      console.warn(`[migrate-retry] failed — waiting ${delaySec}s (close other DB connections / stop dev servers)`);
      await sleep(delaySec * 1000);
    }
  }
  console.error('[migrate-retry] all attempts failed. Use DIRECT_URL (port 5432) and stop running node processes.');
  process.exit(1);
}

main();
