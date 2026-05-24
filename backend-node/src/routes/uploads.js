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
const os = require('os');
const { logger } = require('../lib/logger');
const { processUploadedVideo } = require('../lib/processUploadedVideo');
const { ensureSupabaseUploadBucket } = require('../lib/supabaseStorageBucket');
const {
  resolveSupabaseUrl,
  resolveSupabaseServiceKey,
  isSupabaseStorageConfigured,
} = require('../lib/supabaseConfig');

const router = express.Router();
router.use(authMiddleware);

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'taqwin-uploads';
const ALLOWED_FOLDERS = new Set(['avatars', 'products', 'gyms', 'posts', 'covers', 'support', 'messages', 'stories', 'progress']);
const UPLOAD_ROOT = path.join(__dirname, '../../uploads');

const signSchema = z.object({
  body: z.object({
    folder: z.enum(['avatars', 'products', 'gyms', 'posts', 'covers', 'support', 'messages', 'stories', 'progress']),
    contentType: z.string().min(3).max(100),
    ext: z.string().regex(/^[a-z0-9]{1,8}$/).optional(),
  }),
});

const localFolderSchema = z.object({
  body: z.object({
    folder: z.enum(['avatars', 'products', 'gyms', 'posts', 'covers', 'support', 'messages', 'stories', 'progress']),
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
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  };
  return map[mime] || mime.split('/')[1]?.slice(0, 8) || 'bin';
}

function isVideoUpload(file) {
  if (!file) return false;
  if (file.mimetype?.startsWith('video/')) return true;
  return /\.(mp4|webm|mov|m4v|avi|mkv|3gp)$/i.test(file.originalname || '');
}

function isAllowedVideoFolder(folder) {
  return folder === 'posts' || folder === 'stories';
}

function isAllowedContentType(folder, mime) {
  if (mime.startsWith('image/')) return /^image\/(png|jpeg|jpg|webp|gif)$/.test(mime);
  if (folder === 'posts' && mime.startsWith('video/')) {
    return /^video\/(mp4|webm|quicktime)$/.test(mime);
  }
  if (folder === 'stories' && mime.startsWith('video/')) {
    return /^video\/(mp4|webm|quicktime)$/.test(mime);
  }
  if (folder === 'messages' && mime.startsWith('audio/')) {
    return /^audio\/(webm|mpeg|mp4|ogg|wav|x-m4a)$/.test(mime);
  }
  if (folder === 'messages' && mime.startsWith('image/')) {
    return /^image\/(png|jpeg|jpg|webp|gif)$/.test(mime);
  }
  return false;
}

function publicBaseUrl(req) {
  const { resolveApiPublicBase } = require('../lib/normalizeMediaUrl');
  if (process.env.API_PUBLIC_URL) return resolveApiPublicBase();
  if (process.env.RENDER_EXTERNAL_URL) return resolveApiPublicBase();
  const host = req.get('host');
  const proto = req.get('x-forwarded-proto') || req.protocol;
  const scheme = host?.includes('onrender.com') && proto === 'http' ? 'https' : proto;
  return `${scheme}://${host}`;
}

function resolveUploadFolder(req) {
  const raw = req.body?.folder ?? req.query?.folder;
  const folder = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : 'posts';
  return ALLOWED_FOLDERS.has(folder) ? folder : 'posts';
}

const diskStorage = multer.diskStorage({
  destination(req, _file, cb) {
    const folder = resolveUploadFolder(req);
    req.body.folder = folder;
    const dir = path.join(UPLOAD_ROOT, folder, req.user.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    cb(null, `${crypto.randomUUID()}.${extFromMime(file.mimetype)}`);
  },
});

const uploadMedia = multer({
  storage: diskStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const folder = resolveUploadFolder(req);
    req.body.folder = folder;
    if (isAllowedContentType(folder, file.mimetype)) cb(null, true);
    else cb(new Error('File type not allowed'));
  },
});

const videoTempStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dir = path.join(os.tmpdir(), 'taqwin-video-uploads');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '') || `.${extFromMime(file.mimetype)}`;
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const uploadVideoRaw = multer({
  storage: videoTempStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const folder = resolveUploadFolder(req);
    req.body.folder = folder;
    if (!isAllowedVideoFolder(folder)) {
      cb(new Error('Videos can only be uploaded to posts or stories'));
      return;
    }
    if (isVideoUpload(file)) cb(null, true);
    else cb(new Error('File type not allowed'));
  },
});

router.post('/sign', validate(signSchema), async (req, res, next) => {
  try {
    if (!isAllowedContentType(req.body.folder, req.body.contentType)) {
      return res.status(400).json({ error: 'Content type not allowed for this folder' });
    }
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
  (req, res, next) => {
    uploadMedia.single('file')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'Upload failed' });
      }
      next();
    });
  },
  validate(localFolderSchema),
  async (req, res, next) => {
    try {
      if (process.env.NODE_ENV === 'production' && isSupabaseStorageConfigured()) {
        return res.status(503).json({
          error: 'Local disk uploads are disabled in production. Use the signed upload flow.',
        });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      const folder = resolveUploadFolder(req);
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

router.post(
  '/video',
  (req, res, next) => {
    uploadVideoRaw.single('file')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'Upload failed' });
      }
      next();
    });
  },
  validate(localFolderSchema),
  async (req, res, _next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No video uploaded' });
      }
      const folder = resolveUploadFolder(req);
      if (!isAllowedVideoFolder(folder)) {
        return res.status(400).json({ error: 'Videos can only be uploaded to posts or stories' });
      }

      await ensureSupabaseUploadBucket(BUCKET);

      const publicUrl = await processUploadedVideo({
        req,
        inputPath: req.file.path,
        folder,
        userId: req.user.id,
        getSupabase,
        bucket: BUCKET,
        uploadRoot: UPLOAD_ROOT,
        publicBaseUrl,
      });

      res.json({
        mode: isSupabaseStorageConfigured() ? 'supabase' : 'local',
        publicUrl,
        contentType: 'video/mp4',
      });
    } catch (err) {
      logger.warn({ err }, 'Video transcode upload failed');
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Video conversion failed',
      });
    }
  },
);

router.get('/status', async (_req, res) => {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'taqwin-uploads';
  let bucketVideoSupport = null;
  if (isSupabaseStorageConfigured()) {
    try {
      const { getSupabaseAdmin, bucketAllowsVideo } = require('../lib/supabaseStorageBucket');
      const sb = getSupabaseAdmin();
      if (sb) {
        const { data } = await sb.storage.getBucket(bucket);
        bucketVideoSupport = data ? bucketAllowsVideo(data.allowed_mime_types) : null;
      }
    } catch {
      bucketVideoSupport = null;
    }
  }
  res.json({
    supabase: isSupabaseStorageConfigured(),
    supabaseUrl: resolveSupabaseUrl(),
    localFallback: true,
    bucket,
    bucketVideoSupport,
  });
});

module.exports = router;
