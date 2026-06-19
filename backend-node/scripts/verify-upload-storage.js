#!/usr/bin/env node
/**
 * Verify Supabase Storage for production uploads.
 * Usage: node scripts/verify-upload-storage.js
 */
require('dotenv').config();

const {
  resolveSupabaseUrl,
  resolveSupabaseServiceKey,
  isSupabaseStorageConfigured,
} = require('../src/lib/supabaseConfig');
const { ensureSupabaseUploadBucket, bucketAllowsVideo } = require('../src/lib/supabaseStorageBucket');
const { resolveApiPublicBase } = require('../src/lib/normalizeMediaUrl');

async function main() {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'taqwin-uploads';
  console.log('Upload storage verify\n');

  if (!isSupabaseStorageConfigured()) {
    console.error('FAIL  SUPABASE_URL and SUPABASE_SERVICE_KEY (service role) are required in production.');
    console.error('      Set them in deploy/.env on the VPS.');
    process.exit(1);
  }

  console.log(`OK    Supabase URL: ${resolveSupabaseUrl()}`);
  console.log(`OK    Service key: set (${resolveSupabaseServiceKey().length} chars)`);
  console.log(`OK    API public base: ${resolveApiPublicBase()}`);

  const result = await ensureSupabaseUploadBucket(bucket);
  if (result.error) {
    console.error(`FAIL  Bucket "${bucket}": ${result.error}`);
    process.exit(1);
  }

  const { getSupabaseAdmin } = require('../src/lib/supabaseStorageBucket');
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.storage.getBucket(bucket);
  if (error) {
    console.error(`FAIL  getBucket: ${error.message}`);
    process.exit(1);
  }

  console.log(`OK    Bucket "${bucket}" exists (public=${data.public})`);
  console.log(`OK    Video MIME support: ${bucketAllowsVideo(data.allowed_mime_types)}`);
  console.log('\nUpload storage verify PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
