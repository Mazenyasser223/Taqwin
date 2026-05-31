const { createClient } = require('@supabase/supabase-js');
const { logger } = require('./logger');
const {
  resolveSupabaseUrl,
  resolveSupabaseServiceKey,
  isSupabaseStorageConfigured,
} = require('./supabaseConfig');

const DEFAULT_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'taqwin-uploads';

/** MIME types accepted across avatars, posts, stories, and voice notes. */
const UPLOAD_BUCKET_MIME_TYPES = [
  'image/*',
  'video/*',
  'audio/*',
  'application/octet-stream',
];

const UPLOAD_BUCKET_FILE_SIZE_LIMIT = 50 * 1024 * 1024;

let supabaseAdmin;

function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;
  const url = resolveSupabaseUrl();
  const key = resolveSupabaseServiceKey();
  if (!url || !key) return null;
  supabaseAdmin = createClient(url, key, { auth: { persistSession: false } });
  return supabaseAdmin;
}

function bucketAllowsVideo(allowedMimeTypes) {
  if (!allowedMimeTypes?.length) return true;
  return allowedMimeTypes.some(
    (mime) =>
      mime === 'video/*' ||
      mime.startsWith('video/') ||
      mime === 'application/octet-stream' ||
      mime === '*/*',
  );
}

/**
 * Ensure taqwin-uploads accepts images + videos (fixes "mime type video/mp4 is not supported").
 */
async function ensureSupabaseUploadBucket(bucketName = DEFAULT_BUCKET) {
  if (!isSupabaseStorageConfigured()) {
    return { ok: false, skipped: true, reason: 'Supabase Storage not configured' };
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    return { ok: false, skipped: true, reason: 'Supabase client unavailable' };
  }

  const { data: bucket, error: getError } = await sb.storage.getBucket(bucketName);

  if (getError) {
    const notFound = /not found|does not exist/i.test(getError.message || '');
    if (!notFound) {
      logger.warn({ err: getError.message, bucketName }, 'Supabase getBucket failed');
      return { ok: false, error: getError.message };
    }

    const { error: createError } = await sb.storage.createBucket(bucketName, {
      public: true,
      allowedMimeTypes: UPLOAD_BUCKET_MIME_TYPES,
      fileSizeLimit: UPLOAD_BUCKET_FILE_SIZE_LIMIT,
    });

    if (createError) {
      logger.warn({ err: createError.message, bucketName }, 'Supabase createBucket failed');
      return { ok: false, error: createError.message };
    }

    logger.info({ bucketName }, 'Created Supabase upload bucket with video support');
    return { ok: true, created: true, bucketName };
  }

  const needsVideo = !bucketAllowsVideo(bucket.allowed_mime_types);
  const needsPublic = bucket.public !== true;
  const sizeLimit = bucket.file_size_limit ?? null;
  const needsSize = sizeLimit != null && Number(sizeLimit) < UPLOAD_BUCKET_FILE_SIZE_LIMIT;

  if (!needsVideo && !needsPublic && !needsSize) {
    return { ok: true, unchanged: true, bucketName };
  }

  const { error: updateError } = await sb.storage.updateBucket(bucketName, {
    public: true,
    allowedMimeTypes: UPLOAD_BUCKET_MIME_TYPES,
    fileSizeLimit: UPLOAD_BUCKET_FILE_SIZE_LIMIT,
  });

  if (updateError) {
    logger.warn({ err: updateError.message, bucketName }, 'Supabase updateBucket failed');
    return { ok: false, error: updateError.message };
  }

  logger.info(
    { bucketName, needsVideo, needsPublic, needsSize },
    'Updated Supabase upload bucket for video support',
  );
  return { ok: true, updated: true, bucketName };
}

module.exports = {
  DEFAULT_BUCKET,
  UPLOAD_BUCKET_MIME_TYPES,
  ensureSupabaseUploadBucket,
  bucketAllowsVideo,
  getSupabaseAdmin,
};
