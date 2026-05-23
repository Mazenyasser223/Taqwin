/**
 * English → Arabic food names (logged items, seed catalog).
 */
const { sleep } = require('./webtebScraper');

const cache = new Map();

function cleanArabic(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["']|["']$/g, '');
}

function hasArabic(text) {
  return /[\u0600-\u06FF]/.test(String(text || ''));
}

async function translateWithGemini(nameEn) {
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
              text: `Translate this food name to natural Arabic (nutrition context). Use common terms in Egypt/Gulf Arabic. Reply with ONLY the Arabic name, no quotes.\n\n${nameEn}`,
            },
          ],
        },
      ],
      config: { temperature: 0.2 },
    });
    const text = cleanArabic(res?.text);
    return text || null;
  } catch {
    return null;
  }
}

async function translateWithGoogleGtx(nameEn) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=${encodeURIComponent(nameEn)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TaqwinNutrition/1.0)' },
  });
  if (!res.ok) return null;
  const raw = await res.text();
  const data = JSON.parse(raw);
  const parts = data[0];
  if (!Array.isArray(parts)) return null;
  const ar = cleanArabic(parts.map((p) => p[0]).join(''));
  if (!ar || /MYMEMORY|error/i.test(ar)) return null;
  return ar;
}

async function translateFoodNameEnToAr(nameEn, opts = {}) {
  const trimmed = String(nameEn || '').trim();
  if (!trimmed) return null;
  if (hasArabic(trimmed)) return trimmed;

  if (cache.has(trimmed)) return cache.get(trimmed);

  const delayMs = opts.delayMs ?? (Number(process.env.FOOD_TRANSLATE_DELAY_MS) || 200);
  let ar = (await translateWithGemini(trimmed)) || (await translateWithGoogleGtx(trimmed));
  if (delayMs > 0) await sleep(delayMs);
  if (!ar) ar = trimmed;
  cache.set(trimmed, ar);
  return ar;
}

module.exports = {
  translateFoodNameEnToAr,
  hasArabic,
};
