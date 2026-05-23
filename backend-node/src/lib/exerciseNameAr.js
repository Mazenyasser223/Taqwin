/**
 * English → Arabic exercise names (MuscleWiki catalog).
 * Providers: in-memory cache → Gemini → Ollama → Google Translate (gtx).
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
              text: `Translate this gym exercise name to natural Arabic (fitness context). Use common gym terms in Egypt/Gulf Arabic. Reply with ONLY the Arabic name, no quotes.\n\n${nameEn}`,
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

async function translateWithOllama(nameEn) {
  const base = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const model = process.env.OLLAMA_MODEL || 'llama3.2:latest';
  try {
    const res = await fetch(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: `Translate this gym exercise name to Arabic. Reply with ONLY the Arabic exercise name.\n\n${nameEn}`,
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return cleanArabic(data.response);
  } catch {
    return null;
  }
}

async function translateWithGoogleGtx(nameEn) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=${encodeURIComponent(nameEn)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TaqwinExercises/1.0)' },
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

function needsNameAr(exercise) {
  const ar = exercise?.nameAr ?? exercise?.name_ar;
  return !ar || !String(ar).trim();
}

/**
 * @param {string} nameEn
 * @param {{ delayMs?: number }} [opts]
 * @returns {Promise<string|null>}
 */
async function translateExerciseNameEnToAr(nameEn, opts = {}) {
  const trimmed = String(nameEn || '').trim();
  if (!trimmed) return null;
  if (hasArabic(trimmed)) return trimmed;

  if (cache.has(trimmed)) return cache.get(trimmed);

  const delayMs = opts.delayMs ?? (Number(process.env.EXERCISE_TRANSLATE_DELAY_MS) || 200);

  let ar =
    (await translateWithGemini(trimmed)) ||
    (await translateWithOllama(trimmed)) ||
    (await translateWithGoogleGtx(trimmed));

  if (delayMs > 0) await sleep(delayMs);

  if (!ar) ar = trimmed;
  cache.set(trimmed, ar);
  return ar;
}

/**
 * @param {object} exercise
 * @param {import('@prisma/client').PrismaClient} [prisma]
 */
async function ensureExerciseNameAr(exercise, prisma) {
  if (!exercise || !needsNameAr(exercise)) return exercise;
  const nameEn = exercise.name;
  const nameAr = await translateExerciseNameEnToAr(nameEn, { delayMs: 0 });
  if (!nameAr) return exercise;
  if (prisma && exercise.id) {
    prisma.exercise
      .update({ where: { id: exercise.id }, data: { nameAr } })
      .catch(() => {});
  }
  return { ...exercise, nameAr };
}

/**
 * @param {object[]} exercises
 * @param {import('@prisma/client').PrismaClient} [prisma]
 * @param {{ max?: number }} [opts]
 */
async function ensureExercisesNameAr(exercises, prisma, opts = {}) {
  if (!Array.isArray(exercises) || exercises.length === 0) return exercises;
  const missing = exercises.filter(needsNameAr);
  if (missing.length === 0) return exercises;

  const cap = opts.max ?? 24;
  const batch = missing.slice(0, cap);
  const byId = new Map();

  for (const ex of batch) {
    const enriched = await ensureExerciseNameAr(ex, prisma);
    if (enriched.id) byId.set(enriched.id, enriched.nameAr);
  }

  return exercises.map((ex) => (byId.has(ex.id) ? { ...ex, nameAr: byId.get(ex.id) } : ex));
}

module.exports = {
  translateExerciseNameEnToAr,
  ensureExerciseNameAr,
  ensureExercisesNameAr,
  needsNameAr,
  hasArabic,
};
