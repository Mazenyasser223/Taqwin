/**
 * Progress photos — AI body validation, analysis, and persistence.
 *
 *   POST /api/progress-photos/analyze — upload, validate body + pose, save ProgressPhoto
 */
const express = require('express');
const multer = require('multer');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { prisma } = require('../db');
const { logger } = require('../lib/logger');
const { analyzeProgressPhotoWithClaude } = require('../lib/progressPhoto/claudeAnalyze');
const { storeProgressPhoto, resolveMimeType } = require('../lib/progressPhoto/storage');
const {
  analyzeBodySchema,
  isAcceptedVisionResult,
  publicRejectReason,
} = require('../lib/progressPhoto/schema');
const { invalidateContextBundle } = require('../lib/contextBundle');

const router = express.Router();
router.use(authMiddleware);
router.use(requireRole('athlete'));

const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
const MAX_BYTES = Number(process.env.PROGRESS_PHOTO_MAX_UPLOAD_BYTES || 8 * 1024 * 1024);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIMES.has(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, WEBP, and GIF images are allowed'));
  },
});

router.post('/analyze', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    next();
  });
}, (req, res, next) => {
  try {
    req.body = analyzeBodySchema.parse(req.body ?? {});
    next();
  } catch {
    return res.status(400).json({ error: 'pose is required (front, side, or back)' });
  }
}, async (req, res, next) => {
  try {
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const expectedPose = req.body.pose;
    const mimeType = resolveMimeType(req.file.buffer, req.file.mimetype);

    const vision = await analyzeProgressPhotoWithClaude(
      { buffer: req.file.buffer, mimeType },
      expectedPose,
    );

    if (!isAcceptedVisionResult(vision, expectedPose)) {
      return res.status(422).json({
        error: publicRejectReason(vision, expectedPose),
        code: vision.isBodyPhoto ? 'POSE_MISMATCH' : 'NOT_BODY_PHOTO',
        validation: {
          isBodyPhoto: vision.isBodyPhoto,
          detectedPose: vision.detectedPose,
          poseMatchesExpected: vision.poseMatchesExpected,
          confidence: vision.confidence,
        },
      });
    }

    const stored = await storeProgressPhoto({
      userId: req.user.id,
      buffer: req.file.buffer,
      mimeType,
      req,
    });

    const row = await prisma.progressPhoto.create({
      data: {
        userId: req.user.id,
        storagePath: stored.photoUrl,
        pose: expectedPose,
        analysis: vision.analysis ?? undefined,
        caption: vision.analysis?.coachingNotes ?? vision.analysis?.postureNotes ?? null,
      },
    });

    await invalidateContextBundle(req.user.id).catch(() => null);

    res.status(201).json({
      progressPhoto: {
        id: row.id,
        photoUrl: stored.photoUrl,
        pose: row.pose,
        analysis: row.analysis,
        takenAt: row.takenAt,
      },
      validation: {
        isBodyPhoto: vision.isBodyPhoto,
        detectedPose: vision.detectedPose,
        poseMatchesExpected: vision.poseMatchesExpected,
        confidence: vision.confidence,
      },
    });
  } catch (err) {
    logger.error({ err, userId: req.user.id }, 'POST /progress-photos/analyze failed');
    next(err);
  }
});

module.exports = router;
