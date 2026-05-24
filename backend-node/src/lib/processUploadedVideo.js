const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { transcodeToWebMp4 } = require('./transcodeVideo');
const { logger } = require('./logger');

function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}

function isMimeRejectedError(message) {
  return /mime type|not supported|invalid.?mime/i.test(message || '');
}

async function uploadVideoBufferToSupabase(sb, bucket, key, buffer) {
  const contentTypes = ['application/octet-stream', 'video/mp4', undefined];
  let lastMessage = 'Failed to store converted video';

  for (const contentType of contentTypes) {
    const options = { upsert: true };
    if (contentType) options.contentType = contentType;

    const { error } = await sb.storage.from(bucket).upload(key, buffer, options);
    if (!error) return;

    lastMessage = error.message || lastMessage;
    if (!isMimeRejectedError(lastMessage)) {
      throw new Error(lastMessage);
    }
  }

  throw new Error(lastMessage);
}

function storeWebVideoLocal({ req, folder, userId, mp4Path, uploadRoot, publicBaseUrl }) {
  const destDir = path.join(uploadRoot, folder, userId);
  fs.mkdirSync(destDir, { recursive: true });
  const filename = `${crypto.randomUUID()}.mp4`;
  const destPath = path.join(destDir, filename);
  fs.copyFileSync(mp4Path, destPath);
  return `${publicBaseUrl(req)}/uploads/${folder}/${userId}/${filename}`;
}

/**
 * Store a web-ready MP4 in Supabase (when configured) or local uploads disk.
 */
async function storeWebVideo({ req, folder, userId, mp4Path, getSupabase, bucket, uploadRoot, publicBaseUrl }) {
  const key = `${folder}/${userId}/${crypto.randomUUID()}.mp4`;
  const sb = getSupabase?.();

  if (sb) {
    const buffer = fs.readFileSync(mp4Path);
    try {
      await uploadVideoBufferToSupabase(sb, bucket, key, buffer);
      return sb.storage.from(bucket).getPublicUrl(key).data.publicUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ err: message, bucket }, 'Supabase video upload failed');

      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          isMimeRejectedError(message)
            ? 'Video storage is not configured for MP4 on Supabase. Open Storage → taqwin-uploads → allow video/mp4 (or clear MIME restrictions).'
            : message,
        );
      }

      logger.info('Falling back to local disk for converted video (development)');
      return storeWebVideoLocal({ req, folder, userId, mp4Path, uploadRoot, publicBaseUrl });
    }
  }

  return storeWebVideoLocal({ req, folder, userId, mp4Path, uploadRoot, publicBaseUrl });
}

/**
 * Accept a raw upload, transcode to MP4 H.264, store, and return public URL.
 */
async function processUploadedVideo({
  req,
  inputPath,
  folder,
  userId,
  onProgress,
  getSupabase,
  bucket,
  uploadRoot,
  publicBaseUrl,
}) {
  const outputPath = `${inputPath}.web.mp4`;
  try {
    await transcodeToWebMp4(inputPath, outputPath, onProgress);
    const publicUrl = await storeWebVideo({
      req,
      folder,
      userId,
      mp4Path: outputPath,
      getSupabase,
      bucket,
      uploadRoot,
      publicBaseUrl,
    });
    return publicUrl;
  } finally {
    safeUnlink(inputPath);
    safeUnlink(outputPath);
  }
}

module.exports = { processUploadedVideo, uploadVideoBufferToSupabase };
