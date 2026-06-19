/**
 * Store InBody report files — Supabase Storage with local disk fallback.
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
  return fallback;
}

function resolveMimeType(buffer, declared) {
  if (declared === 'application/pdf') return declared;
  if (declared?.startsWith('image/') || declared === 'application/octet-stream') {
    return sniffImageMime(buffer, declared?.startsWith('image/') ? declared : 'image/jpeg');
  }
  return declared || 'application/octet-stream';
}

function extFromMime(mime) {
  const map = {
    'application/pdf': 'pdf',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
  };
  return map[mime] || 'bin';
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

const { publicUploadUrl } = require('../normalizeMediaUrl');

function localPublicUrl(req, relative) {
  return publicUploadUrl(relative, req);
}

/**
 * @param {{ userId: string, buffer: Buffer, mimeType: string, req?: import('express').Request }} opts
 */
async function storeInbodyReport({ userId, buffer, mimeType, req }) {
  const resolvedMime = resolveMimeType(buffer, mimeType);
  const ext = extFromMime(resolvedMime);
  const filename = `${crypto.randomUUID()}.${ext}`;
  const key = `inbody/${userId}/${filename}`;

  const sb = getSupabase();
  if (sb && isSupabaseStorageConfigured()) {
    try {
      await ensureSupabaseUploadBucket(BUCKET);
      const { error } = await sb.storage.from(BUCKET).upload(key, buffer, {
        contentType: resolvedMime,
        upsert: false,
      });
      if (error) {
        logger.warn({ err: error.message || error, key }, 'Supabase InBody upload failed, falling back to local');
      } else {
        const { data } = sb.storage.from(BUCKET).getPublicUrl(key);
        return { reportUrl: data.publicUrl, storageKey: key, mode: 'supabase' };
      }
    } catch (err) {
      logger.warn({ err: err.message || err, key }, 'Supabase InBody storage error, falling back to local');
    }
  }

  const dir = path.join(UPLOAD_ROOT, 'inbody', userId);
  fs.mkdirSync(dir, { recursive: true });
  const abs = path.join(dir, filename);
  fs.writeFileSync(abs, buffer);
  const relative = path.relative(UPLOAD_ROOT, abs).split(path.sep).join('/');
  return {
    reportUrl: localPublicUrl(req, relative),
    storageKey: relative,
    mode: 'local',
  };
}

module.exports = { storeInbodyReport, extFromMime, resolveMimeType, sniffImageMime };
