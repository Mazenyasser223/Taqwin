#!/usr/bin/env node
/**
 * Verify media upload readiness (Supabase bucket + env).
 * Usage:
 *   node scripts/verify-uploads-production.js
 *   node scripts/verify-uploads-production.js --url https://api.taqwin.online/health
 */
require('dotenv').config({ override: true });

const urlArg =
  process.argv.find((a) => a.startsWith('--url='))?.slice(6) ||
  (process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : null);

async function checkLocalEnv() {
  const { isSupabaseStorageConfigured, resolveSupabaseUrl } = require('../src/lib/supabaseConfig');
  const { ensureSupabaseUploadBucket, DEFAULT_BUCKET } = require('../src/lib/supabaseStorageBucket');

  if (!isSupabaseStorageConfigured()) {
    console.error('FAIL  SUPABASE_URL + SUPABASE_SERVICE_KEY required in production');
    return false;
  }

  console.log(`OK    Supabase URL: ${resolveSupabaseUrl()}`);
  console.log(`OK    Bucket: ${process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET}`);

  const result = await ensureSupabaseUploadBucket();
  if (result.skipped) {
    console.warn(`WARN  ${result.reason}`);
    return false;
  }
  if (!result.ok) {
    console.error(`FAIL  bucket check: ${result.error}`);
    return false;
  }

  if (result.created) console.log('OK    Bucket created with image + video support');
  else if (result.updated) console.log('OK    Bucket updated for video support');
  else console.log('OK    Bucket ready (public, video/* allowed)');

  return true;
}

async function checkRemoteHealth(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`FAIL  ${url} → HTTP ${res.status}`);
    return false;
  }

  const storage = body?.stores?.storage;
  if (!storage?.configured) {
    console.error('FAIL  Remote health reports storage not configured');
    return false;
  }

  console.log(`OK    ${url} → storage.provider=${storage.provider}, bucket=${storage.bucket}`);
  return true;
}

async function main() {
  console.log('Taqwin uploads / media storage verify\n');
  let ok = true;

  if (urlArg) {
    ok = (await checkRemoteHealth(urlArg)) && ok;
  } else {
    ok = (await checkLocalEnv()) && ok;
    console.log('\nTip: node scripts/verify-uploads-production.js --url https://api.taqwin.online/health');
  }

  if (!ok) process.exit(1);
  console.log('\nUpload readiness checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
