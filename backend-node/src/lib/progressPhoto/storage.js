/**
 * Store progress/body photos — Supabase Storage with local disk fallback.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { logger } = require('../logger');
const { ensureSupabaseUploadBucket } = require('../supabaseStorageBucket');
const {
  resolveSupabaseUrl,
  resolveSupabaseServiceKey,
  isSupabaseStorageConfigured,
  createSupabaseAdminClient,
} = require('../supabaseConfig');

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'taqwin-uploads';
const UPLOAD_ROOT = path.join(__dirname, '../../../uploads');

function sniffImageMime(buffer, fallback = 'image/jpeg') {
  if (!buffer || buffer.length < 4) return fallback;
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'image/gif';
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return 'image/webp';
  return fallback;
}

function resolveMimeType(buffer, declared) {
  if (declared?.startsWith('image/') || declared === 'application/octet-stream') {
    return sniffImageMime(buffer, declared?.startsWith('image/') ? declared : 'image/jpeg');
  }
  return declared || 'image/jpeg';
}

function extFromMime(mime) {
  const map = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return map[mime] || 'jpg';
}

let supabase;
function getSupabase() {
  if (supabase) return supabase;
  const url = resolveSupabaseUrl();
  const key = resolveSupabaseServiceKey();
  if (!url || !key) return null;
  supabase = createSupabaseAdminClient(url, key);
  return supabase;
}

function localPublicUrl(req, relative) {
  const pathOnly = `/uploads/${relative}`;
  if (process.env.API_PUBLIC_URL) {
    return `${process.env.API_PUBLIC_URL.replace(/\/$/, '')}${pathOnly}`;
  }
  if (process.env.NODE_ENV !== 'production') {
    return pathOnly;
  }
  const host = req?.get?.('host');
  const proto = req?.get?.('x-forwarded-proto') || req?.protocol || 'http';
  return host ? `${proto}://${host}${pathOnly}` : pathOnly;
}

async function storeProgressPhoto({ userId, buffer, mimeType, req }) {
  const resolvedMime = resolveMimeType(buffer, mimeType);
  const ext = extFromMime(resolvedMime);
  const filename = `${crypto.randomUUID()}.${ext}`;
  const key = `progress/${userId}/${filename}`;

  const sb = getSupabase();
  if (sb && isSupabaseStorageConfigured()) {
    try {
      await ensureSupabaseUploadBucket(BUCKET);
      const { error } = await sb.storage.from(BUCKET).upload(key, buffer, {
        contentType: resolvedMime,
        upsert: false,
      });
      if (error) {
        logger.warn({ err: error.message || error, key }, 'Supabase progress photo upload failed, falling back to local');
      } else {
        const { data } = sb.storage.from(BUCKET).getPublicUrl(key);
        return { photoUrl: data.publicUrl, storagePath: key, mode: 'supabase' };
      }
    } catch (err) {
      logger.warn({ err: err.message || err, key }, 'Supabase progress photo storage error, falling back to local');
    }
  }

  const dir = path.join(UPLOAD_ROOT, 'progress', userId);
  fs.mkdirSync(dir, { recursive: true });
  const abs = path.join(dir, filename);
  fs.writeFileSync(abs, buffer);
  const relative = path.relative(UPLOAD_ROOT, abs).split(path.sep).join('/');
  return {
    photoUrl: localPublicUrl(req, relative),
    storagePath: relative,
    mode: 'local',
  };
}

module.exports = { storeProgressPhoto, resolveMimeType, sniffImageMime };
