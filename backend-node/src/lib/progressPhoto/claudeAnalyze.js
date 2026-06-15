/**
 * Claude Vision — validate progress photos are body shots and extract posture notes.
 */
const { logger } = require('../logger');
const { visionResultSchema } = require('./schema');
const { sniffImageMime } = require('./storage');

const POSE_LABELS = {
  front: 'front-facing (camera sees chest and face/torso)',
  side: 'side profile (camera sees the side of the body — best for waist and posture)',
  back: 'back-facing (camera sees the back of the body)',
};

const ANALYSIS_SYSTEM = `You are a fitness coach assistant reviewing athlete progress photos for a training app.

Your job:
1. Confirm the image shows a REAL HUMAN BODY suitable for fitness progress tracking (not a car, food, gym equipment, screenshot, meme, document, or random object).
2. Detect which body view is shown: front, side, back, or unknown.
3. Compare the detected view to the EXPECTED view provided by the user.
4. Extract useful coaching observations when it IS a valid body photo.

Return ONLY a single JSON object (no markdown):
{
  "isBodyPhoto": boolean,
  "detectedPose": "front" | "side" | "back" | "unknown",
  "poseMatchesExpected": boolean,
  "confidence": number,
  "rejectionReason": string | null,
  "analysis": {
    "postureNotes": string | null,
    "visibleBodyRegions": string[],
    "waistVisible": boolean | null,
    "chestVisible": boolean | null,
    "shouldersVisible": boolean | null,
    "lightingQuality": "good" | "fair" | "poor" | null,
    "framingQuality": "good" | "fair" | "poor" | null,
    "coachingNotes": string | null
  } | null
}

Rules:
- isBodyPhoto=false for non-human subjects (vehicles, pets only, landscapes, objects, text documents, InBody printouts without a person visible, etc.).
- Partial body is OK if torso/legs are visible for progress tracking; mirror selfies are OK.
- poseMatchesExpected=true only when the visible body orientation clearly matches the expected view.
- confidence: 0.0–1.0 how sure you are this is a usable progress photo for the expected pose.
- rejectionReason: short user-facing sentence when isBodyPhoto=false OR pose clearly wrong OR unusable blur/darkness; otherwise null.
- analysis: null when isBodyPhoto=false. Do NOT guess measurements or body fat — only visible posture/framing notes.
- Be privacy-respectful: describe posture and framing, not identity.`;

function parseJsonFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1]) {
      try {
        return JSON.parse(fence[1].trim());
      } catch {
        /* fall through */
      }
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function buildVisionContent(buffer, mimeType, expectedPose) {
  const imageMime = sniffImageMime(buffer, mimeType?.startsWith('image/') ? mimeType : 'image/jpeg');
  const base64 = buffer.toString('base64');
  return [
    {
      type: 'image',
      source: { type: 'base64', media_type: imageMime, data: base64 },
    },
    {
      type: 'text',
      text: `Expected view: ${expectedPose} (${POSE_LABELS[expectedPose] || expectedPose}). Analyze this progress photo.`,
    },
  ];
}

async function analyzeProgressPhotoWithClaude(file, expectedPose) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const model =
    process.env.PROGRESS_PHOTO_VISION_MODEL ||
    process.env.INBODY_VISION_MODEL ||
    process.env.ANTHROPIC_VISION_MODEL ||
    process.env.ANTHROPIC_MODEL ||
    'claude-haiku-4-5';

  const content = buildVisionContent(file.buffer, file.mimeType, expectedPose);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: Number(process.env.PROGRESS_PHOTO_EXTRACT_MAX_TOKENS || 1024),
      temperature: 0,
      system: ANALYSIS_SYSTEM,
      messages: [{ role: 'user', content }],
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = payload?.error?.message || res.statusText;
    logger.warn({ status: res.status, msg }, 'Progress photo Claude analysis failed');
    throw new Error(`Photo analysis failed (${res.status})`);
  }

  const textBlock = payload.content?.find((b) => b.type === 'text');
  const parsed = parseJsonFromText(textBlock?.text);
  if (!parsed) {
    logger.warn({ response: textBlock?.text?.slice(0, 200) }, 'Progress photo analysis JSON parse failed');
    throw new Error('Could not parse photo analysis response');
  }

  const validated = visionResultSchema.safeParse(parsed);
  if (!validated.success) {
    logger.warn({ issues: validated.error.issues }, 'Progress photo analysis schema validation failed');
    throw new Error('Photo analysis response was invalid');
  }

  return validated.data;
}

module.exports = { analyzeProgressPhotoWithClaude };
