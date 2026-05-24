#!/usr/bin/env node
/**
 * Allow video uploads on Supabase Storage bucket taqwin-uploads.
 *   npm run storage:fix-bucket
 */
require('dotenv').config();
const { ensureSupabaseUploadBucket, DEFAULT_BUCKET } = require('../src/lib/supabaseStorageBucket');

async function main() {
  console.log(`Checking Supabase bucket "${DEFAULT_BUCKET}"…`);
  const result = await ensureSupabaseUploadBucket();
  if (result.skipped) {
    console.log(`Skipped: ${result.reason}`);
    process.exit(0);
  }
  if (!result.ok) {
    console.error(`Failed: ${result.error}`);
    process.exit(1);
  }
  if (result.created) console.log('Bucket created with image + video support.');
  else if (result.updated) console.log('Bucket updated — videos (video/*) are now allowed.');
  else console.log('Bucket already supports videos. No changes needed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
