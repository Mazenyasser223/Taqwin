#!/usr/bin/env node
/**
 * Run prisma migrate deploy using Supabase direct host (not session pooler).
 */
require('dotenv').config({ override: true });

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { inferSupabaseDirectUrl } = require('./lib/supabaseDirectUrl');

const source = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
const direct = inferSupabaseDirectUrl(source);

if (!direct) {
  console.error(
    '[migrate-via-direct] Could not infer db.PROJECT_REF.supabase.co URL. Set DIRECT_URL in .env.',
  );
  process.exit(1);
}

console.log('[migrate-via-direct] migrating via Supabase direct connection (not pooler)…');

const cwd = path.join(__dirname, '..');
const env = { ...process.env, DATABASE_URL: direct, DIRECT_URL: direct };

const deploy = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: true,
  cwd,
  env,
});

if (deploy.status !== 0 && direct !== source) {
  console.warn('[migrate-via-direct] direct host failed — retrying with pooler session URL from .env…');
  const fallback = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    shell: true,
    cwd,
    env: { ...process.env, DATABASE_URL: source, DIRECT_URL: source },
  });
  if (fallback.status !== 0) process.exit(fallback.status ?? 1);
} else if (deploy.status !== 0) {
  process.exit(deploy.status ?? 1);
}

const gen = spawnSync('npx', ['prisma', 'generate'], {
  stdio: 'inherit',
  shell: true,
  cwd,
});

process.exit(gen.status === 0 ? 0 : 1);
