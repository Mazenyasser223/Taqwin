const crypto = require('crypto');
const { ensureSupabaseUploadBucket } = require('./supabaseStorageBucket');

function extFromMime(mime) {
  const map = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'audio/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/x-m4a': 'm4a',
  };
  return map[mime] || mime.split('/')[1]?.slice(0, 8) || 'bin';
}

/**
 * Upload a buffer to Supabase Storage using the service role (no browser CORS).
 */
async function uploadBufferToSupabase({ sb, bucket, folder, userId, buffer, contentType }) {
  await ensureSupabaseUploadBucket(bucket);

  const ext = extFromMime(contentType || 'application/octet-stream');
  const key = `${folder}/${userId}/${crypto.randomUUID()}.${ext}`;

  const contentTypes = [contentType, 'application/octet-stream', undefined].filter(
    (v, i, arr) => arr.indexOf(v) === i,
  );

  let lastError = 'Failed to store file in Supabase';
  for (const ct of contentTypes) {
    const options = { upsert: true };
    if (ct) options.contentType = ct;

    const { error } = await sb.storage.from(bucket).upload(key, buffer, options);
    if (!error) {
      return {
        key,
        publicUrl: sb.storage.from(bucket).getPublicUrl(key).data.publicUrl,
      };
    }
    lastError = error.message || lastError;
    if (!/mime type|not supported|invalid.?mime/i.test(lastError)) {
      throw new Error(lastError);
    }
  }

  throw new Error(lastError);
}

module.exports = { uploadBufferToSupabase, extFromMime };
