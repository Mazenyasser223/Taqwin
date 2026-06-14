/**
 * InBody report upload, AI extraction, and BodyMetric persistence.
 *
 *   POST /api/inbody/extract — upload PDF/image, store report, Claude Vision extract
 *   POST /api/inbody/save    — confirm metrics → BodyMetric row
 */
const express = require('express');
const multer = require('multer');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { prisma } = require('../db');
const { logger } = require('../lib/logger');
const { extractInbodyWithClaude } = require('../lib/inbody/claudeExtract');
const { storeInbodyReport } = require('../lib/inbody/storage');
const { saveInbodySchema, mapExtractedToDb, mapDbToApi } = require('../lib/inbody/schema');
const { invalidateContextBundle } = require('../lib/contextBundle');

const router = express.Router();
router.use(authMiddleware);
router.use(requireRole('athlete'));

const ALLOWED_MIMES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']);
const MAX_BYTES = Number(process.env.INBODY_MAX_UPLOAD_BYTES || 12 * 1024 * 1024);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIMES.has(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF, JPG, JPEG, and PNG files are allowed'));
  },
});

router.post('/extract', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    next();
  });
}, async (req, res, next) => {
  try {
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { resolveMimeType } = require('../lib/inbody/storage');
    const mimeType = resolveMimeType(req.file.buffer, req.file.mimetype);
    const visionInput = {
      buffer: req.file.buffer,
      mimeType,
      filename: req.file.originalname,
    };

    const [storeResult, extractResult] = await Promise.allSettled([
      storeInbodyReport({
        userId: req.user.id,
        buffer: req.file.buffer,
        mimeType,
        req,
      }),
      extractInbodyWithClaude(visionInput),
    ]);

    const reportUrl =
      storeResult.status === 'fulfilled' ? storeResult.value.reportUrl : null;

    if (storeResult.status === 'rejected') {
      logger.warn({ err: storeResult.reason, userId: req.user.id }, 'InBody report storage failed');
    }

    if (extractResult.status === 'rejected') {
      logger.error({ err: extractResult.reason, userId: req.user.id }, 'InBody Claude extraction error');
      return res.status(502).json({
        error: extractResult.reason?.message || 'Failed to extract InBody data',
        reportUrl,
        extracted: null,
      });
    }

    res.json({
      reportUrl,
      extracted: extractResult.value,
    });
  } catch (err) {
    logger.error({ err, userId: req.user.id }, 'POST /inbody/extract failed');
    next(err);
  }
});

router.post('/save', validate(saveInbodySchema), async (req, res, next) => {
  try {
    const body = req.body;
    const dbFields = mapExtractedToDb(body);
    const measuredAt = body.measuredAt
      ? new Date(body.measuredAt)
      : dbFields.measuredAt || null;

    const row = await prisma.bodyMetric.create({
      data: {
        userId: req.user.id,
        ...dbFields,
        measuredAt,
        reportUrl: body.reportUrl ?? null,
        source: body.source ?? 'manual',
      },
    });

    if (dbFields.weightKg != null) {
      await prisma.profile
        .update({
          where: { userId: req.user.id },
          data: { weight: dbFields.weightKg },
        })
        .catch(() => null);
    }

    await invalidateContextBundle(req.user.id).catch(() => null);

    res.status(201).json({ bodyMetric: mapDbToApi(row) });
  } catch (err) {
    logger.error({ err, userId: req.user.id }, 'POST /inbody/save failed');
    next(err);
  }
});

module.exports = router;
