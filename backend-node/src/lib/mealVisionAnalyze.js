/**
 * Claude Vision meal photo analysis — NutriLens-style nutrition estimation.
 */
const { logger } = require('./logger');
const { resolveClosestWebtebFood } = require('./aiToolResolvers');
const { getServiceBaseUrl, isFastApiBridgeEnabled } = require('../services/aiFastApiClient');
const {
  enrichMealCaptureResult,
  sameMealGate,
  itemConfWorst,
} = require('./mealCaptureEnrich');
const { shouldUseCatalogMatch, markKitchenFoodItem } = require('./mealCaptureMatch');

const MAX_IMAGES = 6;
const SPREAD = { high: 0.08, medium: 0.15, low: 0.25 };

function nutritionPrompt(referenceInfo, nViews) {
  return `
You are an expert nutritionist. Provide a highly accurate nutritional analysis of the provided food image(s).

MULTI-SHOT ANALYSIS (${nViews} image(s)):
- Fuse ALL views; combine top-down area with side/oblique cues for volume.
- If views disagree, prefer the majority interpretation and lower confidence if needed.

SAME-MEAL VALIDATION (MANDATORY):
- Before estimating nutrition, verify ALL images show the SAME meal (same plate/bowl, same foods, similar setting).
- If images look like different meals or accidental mixed uploads, set same_meal_validation.passed to false and list issues.
- Set same_meal_validation.confidence 0.0–1.0 (how sure they are the same meal).

IMAGE QUALITY (per image, 1-indexed):
- Assess blur, brightness, resolution, and whether food is clearly visible.
- Set full_plate_visible to false if the plate/bowl is cropped, zoomed too close, or the full meal is not in frame.
- Use blur/brightness/resolution values: "ok", "warn", or "fail".

REFERENCE CALIBRATION:
- Reference object in photo: ${referenceInfo}.
- Use its known size to calibrate scale when visible.
- Set "reference_found": true only if you can locate this object.

CALIBRATION ANCHORS (if reference missing):
- Rice/grains tennis-ball size ~150g boiled; protein deck-of-cards ~100–120g; pasta fist ~180g; butter dice ~10g; dinner plate ~27cm.

ESTIMATION:
1. Identify scale from anchors/reference/cutlery/hands.
2. Deconstruct every component including hidden sauces/oils.
3. Estimate volume then convert to grams; macros: protein/carbs 4 kcal/g, fat 9 kcal/g.

HIDDEN CALORIES (MANDATORY):
- Add separate items for cooking oil, butter, sauces, dressings when inferred from cooking method.
- Mark hidden sources in hidden_calorie_sources.

RULES:
- Be conservative (slight overestimate preferred).
- Break complex dishes into components.
- Classify each item category: main, side, drink, dessert, fruit, vegetable, or condiment.
- Include cooking_style and visible_ingredients when inferable (e.g. grilled, fried, basmati).
- Per-item confidence: high/medium/low for identification, portion_estimation, nutrition_estimation.
- Also set confidence_score per item (0.0–1.0) and overall_confidence on meal_summary (0.0–1.0).
- Calorie ranges: high ±8%, medium ±15%, low ±25% of estimated_calories.
- Sum hidden-calorie items into meal_summary.possible_hidden_calories (oil, butter, sauces, dressings).
- If overall confidence is low, include 1–3 specific follow_up_questions.

Reply with ONLY valid JSON (no markdown) matching:
{
  "same_meal_validation": {
    "passed": true,
    "confidence": 0.95,
    "issues": []
  },
  "image_quality": [
    {
      "index": 1,
      "blur": "ok|warn|fail",
      "brightness": "ok|warn|fail",
      "resolution": "ok|warn|fail",
      "food_visible": true,
      "full_plate_visible": true,
      "notes": "string"
    }
  ],
  "meal_summary": {
    "estimated_calories": integer,
    "calorie_range": { "min": integer, "max": integer },
    "macros": { "protein": integer, "carbs": integer, "fat": integer },
    "confidence": "low|medium|high",
    "overall_confidence": 0.9,
    "possible_hidden_calories": integer
  },
  "food_items": [
    {
      "name": "string",
      "category": "main|side|drink|dessert|fruit|vegetable|condiment",
      "cooking_style": "string",
      "visible_ingredients": ["string"],
      "estimated_weight_grams": integer,
      "portion_description": "string",
      "estimated_calories": integer,
      "calorie_range": { "min": integer, "max": integer },
      "macros": { "protein": integer, "carbs": integer, "fat": integer },
      "confidence": {
        "identification": "low|medium|high",
        "portion_estimation": "low|medium|high",
        "nutrition_estimation": "low|medium|high"
      },
      "confidence_score": 0.88,
      "hidden_calorie_sources": []
    }
  ],
  "analysis_notes": ["string"],
  "follow_up_questions": [],
  "reference_found": true
}`;
}

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
    let depth = 0;
    let inString = false;
    let escape = false;
    let quote = '';
    for (let i = start; i < trimmed.length; i += 1) {
      const ch = trimmed[i];
      if (inString) {
        if (escape) escape = false;
        else if (ch === '\\') escape = true;
        else if (ch === quote) inString = false;
      } else if (ch === '"' || ch === "'") {
        inString = true;
        quote = ch;
      } else if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(trimmed.slice(start, i + 1));
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  }
}

function calorieRange(kcal, conf) {
  const s = SPREAD[conf] ?? 0.15;
  return { min: Math.round(kcal * (1 - s)), max: Math.round(kcal * (1 + s)) };
}

function normalizeToTaqwin(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  if (raw.meal_summary) return raw;

  if (Array.isArray(raw.food_items)) {
    const foodItems = raw.food_items.map((it) => {
      const kcal = Number(it.estimated_calories) || 0;
      const conf = itemConfWorst(it.confidence);
      return {
        name: String(it.name || 'Unknown food'),
        estimated_weight_grams: Number(it.estimated_weight_grams) || 0,
        portion_description: String(it.portion_description || it.portion || ''),
        estimated_calories: kcal,
        calorie_range: it.calorie_range || calorieRange(kcal, conf),
        macros: it.macros || { protein: 0, carbs: 0, fat: 0 },
        confidence:
          typeof it.confidence === 'object'
            ? it.confidence
            : {
                identification: conf,
                portion_estimation: conf,
                nutrition_estimation: conf,
              },
        hidden_calorie_sources: it.hidden_calorie_sources || (it.hidden ? ['cooking fat'] : []),
      };
    });
    const totalKcal =
      Number(raw.total_calories) ||
      foodItems.reduce((sum, i) => sum + (i.estimated_calories || 0), 0);
    const conf = String(raw.confidence || 'medium').toLowerCase();
    return {
      meal_summary: {
        estimated_calories: totalKcal,
        calorie_range: raw.calorie_range || calorieRange(totalKcal, conf),
        macros: {
          protein: foodItems.reduce((s, i) => s + (i.macros?.protein || 0), 0),
          carbs: foodItems.reduce((s, i) => s + (i.macros?.carbs || 0), 0),
          fat: foodItems.reduce((s, i) => s + (i.macros?.fat || 0), 0),
        },
        confidence: conf,
      },
      food_items: foodItems,
      analysis_notes: Array.isArray(raw.analysis_notes)
        ? raw.analysis_notes
        : raw.summary
          ? [String(raw.summary)]
          : [],
      follow_up_questions: raw.follow_up_questions || [],
      reference_found: raw.reference_found !== false,
    };
  }
  return raw;
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

function buildVisionContent(files) {
  const blocks = [];
  for (const file of files) {
    const mime = sniffImageMime(file.buffer, file.mimetype?.startsWith('image/') ? file.mimetype : 'image/jpeg');
    blocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mime,
        data: file.buffer.toString('base64'),
      },
    });
  }
  return blocks;
}

async function callMealVisionViaAiService(files, referenceInfo) {
  const base = getServiceBaseUrl();
  if (!base || !isFastApiBridgeEnabled()) return null;

  const body = {
    referenceInfo,
    images: files.map((file) => ({
      data: file.buffer.toString('base64'),
      mediaType: sniffImageMime(file.buffer, file.mimetype?.startsWith('image/') ? file.mimetype : 'image/jpeg'),
    })),
  };

  try {
    const timeoutMs = Number(process.env.AI_PLAN_SERVICE_TIMEOUT_MS || 180000);
    const res = await fetch(`${base}/meal-capture/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    let payload = null;
    try {
      payload = await res.json();
    } catch {
      /* non-JSON */
    }

    if (!res.ok) {
      const detail = payload?.detail || payload;
      const errCode = detail?.error || payload?.error;
      if (errCode === 'API_KEY_INVALID') return { error: 'API_KEY_INVALID', message: detail?.message };
      if (errCode === 'QUOTA_EXCEEDED') return { error: 'QUOTA_EXCEEDED' };
      logger.warn({ status: res.status, body: JSON.stringify(detail).slice(0, 400) }, 'Meal vision ai-service failed');
      return {
        error: detail?.message || detail?.error || `AI service error (${res.status})`,
      };
    }

    if (payload?.error) return payload;
    return normalizeToTaqwin(payload);
  } catch (err) {
    logger.warn({ err }, 'Meal vision ai-service unreachable');
    return {
      error: 'AI_SERVICE_UNAVAILABLE',
      message: 'Start ai-service (uvicorn on :8000) and ensure AI_SERVICE_URL is set',
    };
  }
}

async function callClaudeVision(files, referenceInfo) {
  const viaService = await callMealVisionViaAiService(files, referenceInfo);
  if (viaService) return viaService;

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return {
      error: 'API_KEY_INVALID',
      message: 'Configure ai-service/.env (ANTHROPIC_API_KEY) and set FEATURE_AI_VIA_FASTAPI=true',
    };
  }

  const model =
    process.env.MEAL_VISION_MODEL ||
    process.env.ANTHROPIC_VISION_MODEL ||
    process.env.ANTHROPIC_MODEL ||
    'claude-sonnet-4-20250514';

  const content = buildVisionContent(files);
  content.push({ type: 'text', text: nutritionPrompt(referenceInfo, files.length) });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: Number(process.env.MEAL_VISION_MAX_TOKENS || 4096),
      temperature: 0,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.warn({ status: res.status, body: text.slice(0, 400) }, 'Meal vision Claude call failed');
    if (res.status === 401) return { error: 'API_KEY_INVALID' };
    if (res.status === 429) return { error: 'QUOTA_EXCEEDED' };
    let msg = text;
    try {
      const errJson = JSON.parse(text);
      msg = errJson?.error?.message || text;
    } catch {
      /* use raw */
    }
    return { error: `HTTP ${res.status}: ${msg}` };
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const parsed = parseJsonFromText(text);
  if (!parsed) return { error: 'Invalid JSON from model' };
  return normalizeToTaqwin(parsed);
}

function parseGramsFromItem(item) {
  const raw = item.estimated_weight_grams;
  if (raw && String(raw).trim() && String(raw) !== '0') {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const portion = String(item.portion_description || item.portion || '');
  const m = portion.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  return m ? Number(m[1]) : null;
}

async function resolveFoodForCapture(item, cache) {
  const queries = [
    item.name,
    ...(Array.isArray(item.visible_ingredients) ? item.visible_ingredients : []),
    item.cooking_style,
    item.category,
  ]
    .map((q) => String(q || '').trim())
    .filter((q) => q.length >= 2);

  const seen = new Set();
  for (const query of queries) {
    const key = query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const resolved = await resolveClosestWebtebFood(query, { cache, fast: true });
    if (resolved?.webtebId) return { resolved, query };
  }
  return { resolved: null, query: item.name };
}

async function crossCheckOneItem(rawItem, cache) {
  let item = { ...rawItem };
  let grams = parseGramsFromItem(item);
  if (!grams || grams <= 0) {
    grams = Number(item.estimated_weight_grams) > 0 ? Number(item.estimated_weight_grams) : 100;
    item.estimated_weight_grams = grams;
  }

  let dbNote = null;
  try {
    const { resolved, query } = await resolveFoodForCapture(item, cache);
    if (resolved?.webtebId && shouldUseCatalogMatch(item, resolved.matchScore)) {
      const factor = grams / 100;
      const worst = itemConfWorst(item.confidence);
      const aiName = item.name;
      item.webtebId = resolved.webtebId;
      item.dbMatched = true;
      item.kitchenFood = false;
      item.dbMatchScore = resolved.matchScore;
      item.dbFoodName = resolved.displayName;
      item.name = resolved.displayName || item.name;
      item.estimated_calories = Math.round(resolved.calories * factor);
      item.macros = {
        protein: Math.round(resolved.protein * factor * 10) / 10,
        carbs: Math.round(resolved.carbs * factor * 10) / 10,
        fat: Math.round(resolved.fat * factor * 10) / 10,
      };
      item.calorie_range = calorieRange(item.estimated_calories, worst);
      const matchNote =
        aiName !== item.name
          ? `'${aiName}' → WebTeb "${item.name}" (${Math.round(grams)} g → ${item.estimated_calories} kcal).`
          : `'${item.name}': nutrition from WebTeb DB (${Math.round(grams)} g → ${item.estimated_calories} kcal).`;
      dbNote = query !== aiName ? `${matchNote} (matched via "${query}")` : matchNote;
    } else if (resolved?.webtebId) {
      item = markKitchenFoodItem({
        ...item,
        dbMatchScore: resolved.matchScore,
        dbFoodName: resolved.displayName,
      });
      dbNote = `'${item.name}': weak catalog match (${Math.round(resolved.matchScore * 100)}%) — kept AI macros as custom food.`;
    } else {
      item = markKitchenFoodItem(item);
      dbNote = `'${item.name}': no catalog match — saved with AI name and macros as custom food.`;
    }
  } catch (err) {
    logger.warn({ err, name: item.name }, 'Meal vision DB cross-check failed');
    item = markKitchenFoodItem(item);
    dbNote = `'${item.name}': catalog lookup failed — kept AI estimate as custom food.`;
  }

  return { item, dbNote };
}

async function crossCheckNutritionDb(result) {
  const items = result.food_items || [];
  const notes = [...(result.analysis_notes || [])];
  const cache = new Map();
  const checked = await Promise.all(items.map((rawItem) => crossCheckOneItem(rawItem, cache)));
  const updated = checked.map((row) => row.item);
  const dbNotes = checked.map((row) => row.dbNote).filter(Boolean);

  if (dbNotes.length) {
    notes.push(...dbNotes);
  }

  const ms = { ...(result.meal_summary || {}) };
  ms.estimated_calories = updated.reduce((s, i) => s + (i.estimated_calories || 0), 0);
  ms.macros = {
    protein: updated.reduce((s, i) => s + (i.macros?.protein || 0), 0),
    carbs: updated.reduce((s, i) => s + (i.macros?.carbs || 0), 0),
    fat: updated.reduce((s, i) => s + (i.macros?.fat || 0), 0),
  };
  ms.calorie_range = calorieRange(ms.estimated_calories, ms.confidence || 'medium');
  return { ...result, food_items: updated, analysis_notes: notes, meal_summary: ms };
}

/**
 * @param {Array<{ buffer: Buffer, mimetype?: string }>} files
 * @param {string} referenceInfo
 */
async function analyzeMealImages(files, referenceInfo = 'None (AI Guess)') {
  if (!files?.length) {
    return { error: 'NO_IMAGES', message: 'Upload at least one meal photo' };
  }
  if (files.length > MAX_IMAGES) {
    return { error: 'TOO_MANY_IMAGES', message: `Maximum ${MAX_IMAGES} images allowed` };
  }

  const raw = await callClaudeVision(files, referenceInfo);
  if (raw?.error) return raw;

  const crossChecked = await crossCheckNutritionDb(raw);
  const enriched = enrichMealCaptureResult(crossChecked);
  const gate = sameMealGate(enriched);
  if (gate) return gate;
  return enriched;
}

module.exports = {
  analyzeMealImages,
  MAX_MEAL_CAPTURE_IMAGES: MAX_IMAGES,
};
