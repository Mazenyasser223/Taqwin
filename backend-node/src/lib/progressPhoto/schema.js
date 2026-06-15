/**
 * Zod schemas for progress photo AI validation + analysis.
 */
const { z } = require('zod');

const poseEnum = z.enum(['front', 'side', 'back']);

const analysisDetailsSchema = z
  .object({
    postureNotes: z.string().nullable().optional(),
    visibleBodyRegions: z.array(z.string()).optional(),
    waistVisible: z.boolean().nullable().optional(),
    chestVisible: z.boolean().nullable().optional(),
    shouldersVisible: z.boolean().nullable().optional(),
    lightingQuality: z.enum(['good', 'fair', 'poor']).nullable().optional(),
    framingQuality: z.enum(['good', 'fair', 'poor']).nullable().optional(),
    coachingNotes: z.string().nullable().optional(),
  })
  .optional()
  .nullable();

const visionResultSchema = z.object({
  isBodyPhoto: z.boolean(),
  detectedPose: z.union([poseEnum, z.literal('unknown')]),
  poseMatchesExpected: z.boolean(),
  confidence: z.number().min(0).max(1),
  rejectionReason: z.string().nullable().optional(),
  analysis: analysisDetailsSchema,
});

const analyzeBodySchema = z.object({
  pose: poseEnum,
});

const MIN_CONFIDENCE = Number(process.env.PROGRESS_PHOTO_MIN_CONFIDENCE || 0.65);

function isAcceptedVisionResult(result, expectedPose) {
  if (!result.isBodyPhoto) return false;
  if (result.confidence < MIN_CONFIDENCE) return false;
  if (result.poseMatchesExpected) return true;
  if (result.detectedPose === expectedPose) return true;
  return false;
}

function publicRejectReason(result) {
  if (result.rejectionReason?.trim()) return result.rejectionReason.trim();
  if (!result.isBodyPhoto) {
    return 'This does not look like a body progress photo. Please upload a photo of yourself (front, side, or back).';
  }
  if (result.confidence < MIN_CONFIDENCE) {
    return 'We could not clearly see a full body in this photo. Try better lighting and stand farther from the camera.';
  }
  if (!result.poseMatchesExpected && result.detectedPose !== 'unknown') {
    const labels = { front: 'front', side: 'side', back: 'back' };
    return `This looks like a ${labels[result.detectedPose] || result.detectedPose} photo, not the ${labels[expectedPose]} view we need.`;
  }
  return 'This photo does not match the required body progress view. Please try again.';
}

module.exports = {
  poseEnum,
  visionResultSchema,
  analyzeBodySchema,
  isAcceptedVisionResult,
  publicRejectReason,
  MIN_CONFIDENCE,
};
