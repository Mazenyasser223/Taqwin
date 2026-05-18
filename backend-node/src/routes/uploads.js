/**
 * Uploads — Supabase Storage signed-URL flow + local disk fallback for dev.
 *
 *   POST /api/uploads/sign     — Supabase signed URL (when configured)
 *   POST /api/uploads/local    — multipart file save to server disk
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { z } = require('zod');
const multer = require('multer');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { logger } = require('../lib/logger');
const {
  resolveSupabaseUrl,
  resolveSupabaseServiceKey,
  isSupabaseStorageConfigured,
} = require('../lib/supabaseConfig');

const router = express.Router();
router.use(authMiddleware);

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'taqwin-uploads';
const ALLOWED_FOLDERS = new Set(['avatars', 'products', 'gyms', 'posts', 'support']);
const UPLOAD_ROOT = path.join(__dirname, '../../uploads');

const signSchema = z.object({
  body: z.object({
    folder: z.enum(['avatars', 'products', 'gyms', 'posts', 'support']),
    contentType: z.string().regex(/^image\/(png|jpeg|jpg|webp|gif)$/),
    ext: z.string().regex(/^[a-z0-9]{1,8}$/).optional(),
  }),
});

const localFolderSchema = z.object({
  body: z.object({
    folder: z.enum(['avatars', 'products', 'gyms', 'posts', 'support']),
  }),
});

let supabase;
function getSupabase() {
  if (supabase) return supabase;
  const url = resolveSupabaseUrl();
  const key = resolveSupabaseServiceKey();
  if (!url || !key) {
    return null;
  }
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(url, key, { auth: { persistSession: false } });
  return supabase;
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

function publicBaseUrl(req) {
  if (process.env.API_PUBLIC_URL) return process.env.API_PUBLIC_URL.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

const diskStorage = multer.diskStorage({
  destination(req, _file, cb) {
    const folder = req.body.folder || 'support';
    const dir = path.join(UPLOAD_ROOT, folder, req.user.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    cb(null, `${crypto.randomUUID()}.${extFromMime(file.mimetype)}`);
  },
});

const upload = multer({
  storage: diskStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

router.post('/sign', validate(signSchema), async (req, res, next) => {
  try {
    const sb = getSupabase();
    if (!sb) {
      return res.json({
        mode: 'local',
        message: 'Supabase Storage not configured — use local upload endpoint.',
      });
    }
    const ext = req.body.ext || req.body.contentType.split('/')[1].replace('jpeg', 'jpg');
    const key = `${req.body.folder}/${req.user.id}/${crypto.randomUUID()}.${ext}`;

    const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(key, { upsert: true });
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

router.post(
  '/local',
  upload.single('file'),
  validate(localFolderSchema),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      const folder = req.body.folder;
      if (!ALLOWED_FOLDERS.has(folder)) {
        return res.status(400).json({ error: 'Invalid upload folder' });
      }

      const relative = path
        .relative(UPLOAD_ROOT, req.file.path)
        .split(path.sep)
        .join('/');
      const publicUrl = `${publicBaseUrl(req)}/uploads/${relative}`;

      res.json({
        mode: 'local',
        key: relative,
        publicUrl,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get('/status', (_req, res) => {
  res.json({
    supabase: isSupabaseStorageConfigured(),
    supabaseUrl: resolveSupabaseUrl(),
    localFallback: true,
  });
});

module.exports = router;
