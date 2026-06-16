/**
 * Claude Vision — extract full structured InBody data from PDF or image reports.
 */
const { logger } = require('../logger');
const { extractedInbodySchema, emptyExtractedPayload } = require('./schema');

const EXTRACTION_SYSTEM = `You are a precise medical/fitness document parser for InBody body composition reports.
Read the attached InBody report (image or PDF). Reports may be in Arabic or English and use different layouts (InBody 120, 270, 570, 770, etc.).

Return ONLY a single JSON object (no markdown, no commentary) with this exact structure:

{
  "patientId": string | null,
  "patientName": string | null,
  "heightCm": number | null,
  "ageYears": number | null,
  "gender": string | null,
  "testDate": string | null,
  "testTime": string | null,
  "location": string | null,
  "deviceModel": string | null,
  "weightKg": number | null,
  "totalBodyWaterL": number | null,
  "proteinKg": number | null,
  "mineralsKg": number | null,
  "bodyFatMassKg": number | null,
  "skeletalMuscleMassKg": number | null,
  "bodyFatPercent": number | null,
  "bmi": number | null,
  "inbodyScore": number | null,
  "targetWeightKg": number | null,
  "weightControlKg": number | null,
  "fatControlKg": number | null,
  "muscleControlKg": number | null,
  "basalMetabolicRate": number | null,
  "waistHipRatio": number | null,
  "visceralFatLevel": number | null,
  "obesityDegreePercent": number | null,
  "segmentalLean": {
    "rightArm": { "kg": number | null, "percent": number | null, "status": string | null },
    "leftArm": { "kg": number | null, "percent": number | null, "status": string | null },
    "trunk": { "kg": number | null, "percent": number | null, "status": string | null },
    "rightLeg": { "kg": number | null, "percent": number | null, "status": string | null },
    "leftLeg": { "kg": number | null, "percent": number | null, "status": string | null }
  } | null,
  "segmentalFat": {
    "rightArm": { "kg": number | null, "percent": number | null, "status": string | null },
    "leftArm": { "kg": number | null, "percent": number | null, "status": string | null },
    "trunk": { "kg": number | null, "percent": number | null, "status": string | null },
    "rightLeg": { "kg": number | null, "percent": number | null, "status": string | null },
    "leftLeg": { "kg": number | null, "percent": number | null, "status": string | null }
  } | null,
  "impedance": {
    "at20kHz": { "rightArm": number | null, "leftArm": number | null, "trunk": number | null, "rightLeg": number | null, "leftLeg": number | null },
    "at100kHz": { "rightArm": number | null, "leftArm": number | null, "trunk": number | null, "rightLeg": number | null, "leftLeg": number | null }
  } | null,
  "history": {
    "previousTestDate": string | null,
    "previousWeightKg": number | null,
    "previousSkeletalMuscleMassKg": number | null,
    "previousBodyFatPercent": number | null
  } | null
}

Field mapping rules:
- Extract values EXACTLY as printed. Never guess or hallucinate.
- Use null for missing, illegible, or absent fields.
- Masses in kg; bodyFatPercent as percentage (17.7 not 0.177); BMR in kcal.
- PBF / Percent Body Fat → bodyFatPercent. SMM / Skeletal Muscle Mass → skeletalMuscleMassKg.
- Weight Control (total) → weightControlKg. Fat Control → fatControlKg. Muscle Control → muscleControlKg.
- Total Body Water in liters → totalBodyWaterL.
- Obesity Degree (%) → obesityDegreePercent.
- testDate as YYYY-MM-DD when visible (convert DD.MM.YYYY or similar).
- testTime as printed (e.g. "17:00").
- segmental status: "under", "normal", or "over" when shown on report.
- impedance keys: RA→rightArm, LA→leftArm, TR→trunk, RL→rightLeg, LL→leftLeg.
- history: previous test comparison values if a history chart/table is present.`;

const EXTRACTION_USER =
  'Extract every visible InBody field from this report into the required JSON object. Include segmental lean, segmental fat, impedance, and history when present.';

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

function sniffImageMime(buffer, fallback = 'image/jpeg') {
  if (!buffer || buffer.length < 4) return fallback;
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif';
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return 'image/webp';
  }
  return fallback;
}

function buildVisionContent(buffer, mimeType) {
  const base64 = buffer.toString('base64');
  const blocks = [];

  if (mimeType === 'application/pdf') {
    blocks.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: base64,
      },
    });
  } else if (mimeType.startsWith('image/') || mimeType === 'application/octet-stream') {
    const imageMime = sniffImageMime(buffer, mimeType.startsWith('image/') ? mimeType : 'image/jpeg');
    blocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: imageMime,
        data: base64,
      },
    });
  } else {
    throw new Error('Unsupported file type for InBody extraction');
  }

  blocks.push({ type: 'text', text: EXTRACTION_USER });
  return blocks;
}

async function extractInbodyWithClaude(file) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const model =
    process.env.INBODY_VISION_MODEL ||
    process.env.ANTHROPIC_VISION_MODEL ||
    process.env.ANTHROPIC_MODEL ||
    'claude-haiku-4-5';

  const content = buildVisionContent(file.buffer, file.mimeType);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: Number(process.env.INBODY_EXTRACT_MAX_TOKENS || 2048),
      temperature: 0,
      system: EXTRACTION_SYSTEM,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.warn({ status: res.status, body: text.slice(0, 400) }, 'InBody Claude extraction failed');
    throw new Error(`InBody extraction failed (${res.status})`);
  }

  const data = await res.json();
  const textBlock = data.content?.find((b) => b.type === 'text');
  const raw = parseJsonFromText(textBlock?.text || '');
  if (!raw) {
    logger.warn({ response: textBlock?.text?.slice(0, 200) }, 'InBody extraction JSON parse failed');
    return emptyExtractedPayload();
  }

  const parsed = extractedInbodySchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.issues }, 'InBody extraction schema validation failed');
    return emptyExtractedPayload();
  }

  return parsed.data;
}

module.exports = { extractInbodyWithClaude, EXTRACTION_SYSTEM };
