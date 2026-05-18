/**
 * Uploads — Supabase Storage signed URLs, or local disk in development.
 *
 *   POST /api/uploads/sign   — Supabase signed PUT URL (if configured)
 *   POST /api/uploads/local  — multipart upload to server disk (fallback)
 *   GET  /api/uploads/status — which backend is active
 */
const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const { z } = require('zod');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { logger } = require('../lib/logger');
const { saveLocalImage, publicUrlForKey } = require('../lib/localUploads');

const router = express.Router();
router.use(authMiddleware);

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'taqwin-uploads';

const signSchema = z.object({
  body: z.object({
    folder: z.enum(['avatars', 'products', 'gyms', 'posts']),
    contentType: z.string().regex(/^image\/(png|jpeg|jpg|webp|gif)$/),
    ext: z.string().regex(/^[a-z0-9]{1,8}$/).optional(),
  }),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    if (/^image\/(png|jpeg|jpg|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only PNG, JPEG, WebP, and GIF images are allowed'));
  },
});

let supabase;
function getSupabase() {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(url, key, { auth: { persistSession: false } });
  return supabase;
}

function storageMode() {
  return getSupabase() ? 'supabase' : 'local';
}

router.get('/status', (_req, res) => {
  res.json({ mode: storageMode(), bucket: BUCKET });
});

router.post('/sign', validate(signSchema), async (req, res, next) => {
  try {
    const sb = getSupabase();
    if (!sb) {
      return res.status(503).json({
        error: 'Supabase Storage is not configured. Use local upload instead.',
        mode: 'local',
        localEndpoint: '/api/uploads/local',
      });
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
      mode: 'supabase',
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

router.use((err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Files must be smaller than 5MB.' });
  }
  if (err?.message?.includes('image')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

router.post('/local', upload.single('file'), async (req, res, next) => {
  try {
    const folder = req.body?.folder;
    if (!folder || !['avatars', 'products', 'gyms', 'posts'].includes(folder)) {
      return res.status(400).json({ error: 'folder is required (avatars|products|gyms|posts)' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'file is required' });
    }

    const { relativeKey } = saveLocalImage({
      folder,
      userId: req.user.id,
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
    });

    const publicUrl = publicUrlForKey(req, relativeKey);
    res.json({
      mode: 'local',
      key: relativeKey,
      publicUrl,
      contentType: req.file.mimetype,
    });
  } catch (err) {
    if (err.message?.includes('image')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
