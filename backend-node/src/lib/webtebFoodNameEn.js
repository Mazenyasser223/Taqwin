/**
 * Arabic → English food names for WebTeb catalog.
 * Providers (first success): in-memory cache → Gemini → Ollama → Google Translate (gtx).
 */
const { sleep } = require('./webtebScraper');

const cache = new Map();

function hasArabic(text) {
  return /[\u0600-\u06FF]/.test(String(text || ''));
}

function cleanEnglish(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["']|["']$/g, '');
}

async function translateWithGemini(nameAr) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const { GoogleGenAI } = require('@google/genai');
    const client = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const res = await client.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Translate this Arabic food name to natural English (food/nutrition context). Reply with ONLY the English name, no quotes.\n\n${nameAr}`,
            },
          ],
        },
      ],
      config: { temperature: 0.2 },
    });
    const text = cleanEnglish(res?.text);
    return text || null;
  } catch {
    return null;
  }
}

async function translateWithOllama(nameAr) {
  const base = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const model = process.env.OLLAMA_MODEL || 'llama3.2:latest';
  try {
    const res = await fetch(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: `Translate this Arabic food name to English. Reply with ONLY the English food name.\n\n${nameAr}`,
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return cleanEnglish(data.response);
  } catch {
    return null;
  }
}

async function translateWithGoogleGtx(nameAr) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=en&dt=t&q=${encodeURIComponent(nameAr)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TaqwinNutrition/1.0)' },
  });
  if (!res.ok) return null;
  const raw = await res.text();
  const data = JSON.parse(raw);
  const parts = data[0];
  if (!Array.isArray(parts)) return null;
  const en = cleanEnglish(parts.map((p) => p[0]).join(''));
  if (!en || /MYMEMORY|error/i.test(en)) return null;
  return en;
}

/**
 * @param {string} nameAr
 * @param {{ delayMs?: number }} [opts]
 * @returns {Promise<string|null>}
 */
async function translateFoodNameArToEn(nameAr, opts = {}) {
  const trimmed = String(nameAr || '').trim();
  if (!trimmed) return null;
  if (!hasArabic(trimmed)) return trimmed;

  if (cache.has(trimmed)) return cache.get(trimmed);

  const delayMs = opts.delayMs ?? (Number(process.env.WEBTEB_TRANSLATE_DELAY_MS) || 300);

  let en =
    (await translateWithGemini(trimmed)) ||
    (await translateWithOllama(trimmed)) ||
    (await translateWithGoogleGtx(trimmed));

  if (delayMs > 0) await sleep(delayMs);

  if (!en) en = trimmed;
  cache.set(trimmed, en);
  return en;
}

function clearTranslationCache() {
  cache.clear();
}

function needsNameEn(food) {
  const en = food?.nameEn;
  return !en || !String(en).trim();
}

/**
 * Fill nameEn on one food row; persist when webtebId is set.
 * @param {object} food
 * @param {import('@prisma/client').PrismaClient} [prisma]
 */
async function ensureFoodNameEn(food, prisma) {
  if (!food || !needsNameEn(food)) return food;
  const nameEn = await translateFoodNameArToEn(food.nameAr, { delayMs: 0 });
  if (!nameEn) return food;
  if (prisma && food.webtebId) {
    prisma.webtebFood
      .update({ where: { webtebId: food.webtebId }, data: { nameEn } })
      .catch(() => {});
  }
  return { ...food, nameEn };
}

/**
 * @param {object[]} foods
 * @param {import('@prisma/client').PrismaClient} [prisma]
 */
async function ensureFoodsNameEn(foods, prisma) {
  if (!Array.isArray(foods) || foods.length === 0) return foods;
  const missing = foods.filter(needsNameEn);
  if (missing.length === 0) return foods;

  const byId = new Map();
  await Promise.all(
    missing.map(async (f) => {
      const enriched = await ensureFoodNameEn(f, prisma);
      if (enriched.webtebId != null) byId.set(enriched.webtebId, enriched.nameEn);
    })
  );

  return foods.map((f) =>
    byId.has(f.webtebId) ? { ...f, nameEn: byId.get(f.webtebId) } : f
  );
}

module.exports = {
  translateFoodNameArToEn,
  ensureFoodNameEn,
  ensureFoodsNameEn,
  clearTranslationCache,
  hasArabic,
  needsNameEn,
};
