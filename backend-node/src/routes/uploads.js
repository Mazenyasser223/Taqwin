/**
 * Uploads — Supabase Storage signed-URL flow.
 *
 *   POST /api/uploads/sign
 *     body: { path: 'avatars'|'products'|'gyms'|'posts', contentType: string, ext?: string }
 *
 * Returns: { uploadUrl, token, publicUrl, key }
 *
 * Frontend uploads directly to Supabase using `uploadUrl` with PUT. After the
 * upload, the publicly-readable URL is `publicUrl` (assuming bucket is public-read).
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_KEY (server-side only).
 */
const express = require('express');
const { z } = require('zod');
const crypto = require('crypto');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { logger } = require('../lib/logger');

const router = express.Router();
router.use(authMiddleware);

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'taqwin-uploads';
const ALLOWED_FOLDERS = new Set(['avatars', 'products', 'gyms', 'posts']);

const signSchema = z.object({
  body: z.object({
    folder: z.enum(['avatars', 'products', 'gyms', 'posts']),
    contentType: z.string().regex(/^image\/(png|jpeg|jpg|webp|gif)$/),
    ext: z.string().regex(/^[a-z0-9]{1,8}$/).optional(),
  }),
});

let supabase;
function getSupabase() {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return null;
  }
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(url, key, { auth: { persistSession: false } });
  return supabase;
}

router.post('/sign', validate(signSchema), async (req, res, next) => {
  try {
    const sb = getSupabase();
    if (!sb) {
      return res
        .status(503)
        .json({ error: 'Uploads are not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.' });
    }
    const ext = req.body.ext || req.body.contentType.split('/')[1].replace('jpeg', 'jpg');
    const key = `${req.body.folder}/${req.user.id}/${crypto.randomUUID()}.${ext}`;

    const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(key);
    if (error) {
      logger.warn({ err: error }, 'Supabase signed URL failed');
      return res.status(500).json({ error: 'Failed to create signed upload URL' });
    }

    const publicUrl = sb.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;

    res.json({
      key,
      uploadUrl: data.signedUrl,
      token: data.token,
      publicUrl,
      bucket: BUCKET,
      contentType: req.body.contentType,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
