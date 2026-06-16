/**
 * Gym review sentiment summary — OpenAI gpt-4o-mini with star-rating fallback.
 */
const { prisma } = require('../db');
const { logger } = require('./logger');

const MAX_REVIEWS = 50;
const OPENAI_MODEL = process.env.GYM_REVIEW_AI_MODEL || 'gpt-4o-mini';

const KEYWORD_PATTERNS = [
  { label: 'Equipment', pattern: /\b(equipment|machines?|weights?|أجهزة|معدات)\b/i },
  { label: 'Friendly', pattern: /\b(friendly|welcoming|staff|ودود|ترحيب|موظف)\b/i },
  { label: 'Clean', pattern: /\b(clean|hygiene|sanitary|نظيف|نظافة)\b/i },
  { label: 'Professional', pattern: /\b(professional|trainers?|coaches?|مدرب|احتراف)\b/i },
  { label: 'Results', pattern: /\b(results?|progress|gains?|نتائج|تقدم)\b/i },
  { label: 'Motivating', pattern: /\b(motivat|inspir|energy|حماس|تحفيز)\b/i },
  { label: 'Value', pattern: /\b(value|price|afford|worth|سعر|قيمة)\b/i },
];

const TEXT_NEGATIVE_PATTERN =
  /\b(bad|terrible|awful|worst|dirty|broken|old|disappoint|hate|never|avoid|overpriced|crowded|rude|unprofessional|waste)\b|سيئ(?:ة|ه)?|قديم(?:ة|ه)?|وسخ(?:ة|ه)?|ردي(?:ء|)|مخيب|مزعج|فظ|غالي|زحمة|لا\s*أنصح|اسوأ|أسوأ/i;
const TEXT_POSITIVE_PATTERN =
  /\b(great|excellent|amazing|love|clean|friendly|professional|recommend|worth|perfect|best)\b|ممتاز(?:ة|ه)?|رائع(?:ة|ه)?|جميل(?:ة|ه)?|نظيف(?:ة|ه)?|ودود|احتراف|أنصح|انصح|مذهل/i;

const SENTIMENT_LABELS = ['positive', 'neutral', 'negative'];

function starSentimentLabel(rating) {
  if (rating >= 4) return 'positive';
  if (rating === 3) return 'neutral';
  return 'negative';
}

function textSentimentLabel(body) {
  const text = String(body || '').trim();
  if (!text) return null;
  const negative = TEXT_NEGATIVE_PATTERN.test(text);
  const positive = TEXT_POSITIVE_PATTERN.test(text);
  if (negative && !positive) return 'negative';
  if (positive && !negative) return 'positive';
  if (negative && positive) return 'neutral';
  return null;
}

/** Text tone wins when it clearly conflicts with stars. */
function resolveReviewSentiment(review) {
  const fromStars = starSentimentLabel(review.rating);
  const fromText = textSentimentLabel(review.body);
  if (!fromText) return fromStars;
  if (fromText === fromStars) return fromStars;
  if (fromText === 'neutral') return fromStars;
  if (fromStars === 'neutral') return fromText;
  return fromText;
}

function aggregateSentimentLabels(labels) {
  if (labels.length === 0) {
    return { positive: 0, neutral: 0, negative: 0 };
  }
  let positive = 0;
  let neutral = 0;
  let negative = 0;
  for (const label of labels) {
    if (label === 'positive') positive += 1;
    else if (label === 'negative') negative += 1;
    else neutral += 1;
  }
  const total = labels.length;
  return normalizePercentages(
    (positive / total) * 100,
    (neutral / total) * 100,
    (negative / total) * 100,
  );
}

function normalizeSentimentLabel(value) {
  const label = String(value || '').trim().toLowerCase();
  return SENTIMENT_LABELS.includes(label) ? label : null;
}

function extractFallbackKeywords(reviews) {
  const scores = new Map();
  for (const review of reviews) {
    for (const { label, pattern } of KEYWORD_PATTERNS) {
      if (pattern.test(review.body)) {
        scores.set(label, (scores.get(label) ?? 0) + 1);
      }
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([label]) => label);
}

function normalizePercentages(positive, neutral, negative) {
  const rounded = {
    positive: Math.round(positive),
    neutral: Math.round(neutral),
    negative: Math.round(negative),
  };
  const drift = 100 - (rounded.positive + rounded.neutral + rounded.negative);
  if (drift !== 0) {
    const raw = { positive, neutral, negative };
    const largest = ['positive', 'neutral', 'negative'].reduce((a, b) =>
      (raw[a] >= raw[b] ? a : b),
    );
    rounded[largest] += drift;
  }
  return rounded;
}

function computeStarSentiment(reviews) {
  if (reviews.length === 0) {
    return { positive: 0, neutral: 0, negative: 0, keywords: [] };
  }

  const labels = reviews.map((review) => resolveReviewSentiment(review));
  const pct = aggregateSentimentLabels(labels);
  return { ...pct, keywords: extractFallbackKeywords(reviews) };
}

function buildReviewPayload(reviews, _gymName) {
  return reviews
    .slice(0, MAX_REVIEWS)
    .map((r, i) => `${i + 1}. [${r.rating}/5] ${r.body.trim()}`)
    .join('\n');
}

async function callOpenAiSummary({ gymName, reviews }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || reviews.length === 0) return null;

  const fetch = require('node-fetch');
  const userContent = [
    `Gym name: ${gymName}`,
    `Number of reviews: ${reviews.length}`,
    '',
    'Reviews (star rating + text):',
    buildReviewPayload(reviews, gymName),
  ].join('\n');

  let res;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.2,
        max_tokens: 800,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You analyze gym member reviews in Arabic and English. '
              + 'For EACH review in order, classify sentiment from the review TEXT as "positive", "neutral", or "negative". '
              + 'Use star ratings only as weak context when the text is vague or empty. '
              + 'When stars and text clearly conflict (e.g. 5 stars but complaining text), ALWAYS follow the text tone. '
              + 'Return ONLY valid JSON with keys: '
              + 'sentiments (array of strings, one per review in the same order — "positive"|"neutral"|"negative"), '
              + 'keywords (array of up to 7 short theme labels from review content — not the gym name, no duplicates).',
          },
          { role: 'user', content: userContent },
        ],
      }),
    });
  } catch (err) {
    logger.warn({ err: err.message }, 'gym review AI request failed');
    return null;
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    logger.warn({ status: res.status, body: errText.slice(0, 200) }, 'gym review AI error response');
    return null;
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content?.trim();
  if (!raw) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.warn({ raw: raw.slice(0, 200) }, 'gym review AI invalid JSON');
    return null;
  }

  const keywords = Array.isArray(parsed.keywords)
    ? parsed.keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 7)
    : [];

  const rawSentiments = Array.isArray(parsed.sentiments) ? parsed.sentiments : null;
  if (rawSentiments && rawSentiments.length === reviews.length) {
    const labels = rawSentiments.map((value, i) => {
      const fromAi = normalizeSentimentLabel(value);
      return fromAi ?? resolveReviewSentiment(reviews[i]);
    });
    const pct = aggregateSentimentLabels(labels);
    return { ...pct, keywords, source: 'openai' };
  }

  // Legacy aggregate-only JSON from older prompts.
  const positive = Number(parsed.positive);
  const neutral = Number(parsed.neutral);
  const negative = Number(parsed.negative);
  if ([positive, neutral, negative].every((n) => Number.isFinite(n))) {
    const pct = normalizePercentages(positive, neutral, negative);
    return { ...pct, keywords, source: 'openai' };
  }

  logger.warn({ raw: raw.slice(0, 200) }, 'gym review AI missing sentiments array');
  return null;
}

async function loadReviews(gymId) {
  return prisma.gymReview.findMany({
    where: { gymId },
    orderBy: { createdAt: 'desc' },
    take: MAX_REVIEWS,
    select: { id: true, rating: true, body: true, updatedAt: true },
  });
}

function reviewsFingerprint(reviews) {
  return reviews.map((r) => `${r.id}:${r.updatedAt.toISOString()}`).join('|');
}

async function analyzeReviews(reviews, gymName) {
  if (reviews.length === 0) {
    return {
      reviewCount: 0,
      positive: 0,
      neutral: 0,
      negative: 0,
      keywords: [],
      source: 'none',
    };
  }

  const ai = await callOpenAiSummary({ gymName, reviews });
  if (ai) {
    return {
      reviewCount: reviews.length,
      positive: ai.positive,
      neutral: ai.neutral,
      negative: ai.negative,
      keywords: ai.keywords,
      source: 'openai',
    };
  }

  const stars = computeStarSentiment(reviews);
  return {
    reviewCount: reviews.length,
    positive: stars.positive,
    neutral: stars.neutral,
    negative: stars.negative,
    keywords: stars.keywords,
    source: 'stars',
  };
}

function formatSummary(row) {
  if (!row) return null;
  const keywords = Array.isArray(row.keywords) ? row.keywords : [];
  return {
    reviewCount: row.reviewCount,
    positive: row.positivePct,
    neutral: row.neutralPct,
    negative: row.negativePct,
    keywords,
    source: row.source,
    analyzedAt: row.analyzedAt.toISOString(),
  };
}

async function saveSummary(gymId, summary, fingerprint) {
  const row = await prisma.gymReviewAnalysis.upsert({
    where: { gymId },
    create: {
      gymId,
      reviewCount: summary.reviewCount,
      positivePct: summary.positive,
      neutralPct: summary.neutral,
      negativePct: summary.negative,
      keywords: summary.keywords,
      source: summary.source,
      reviewsFingerprint: fingerprint,
      analyzedAt: new Date(),
    },
    update: {
      reviewCount: summary.reviewCount,
      positivePct: summary.positive,
      neutralPct: summary.neutral,
      negativePct: summary.negative,
      keywords: summary.keywords,
      source: summary.source,
      reviewsFingerprint: fingerprint,
      analyzedAt: new Date(),
    },
  });
  return formatSummary(row);
}

async function refreshGymReviewAnalysis(gymId, { force = false } = {}) {
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { id: true, name: true, isActive: true },
  });
  if (!gym || !gym.isActive) return null;

  const reviews = await loadReviews(gymId);
  const fingerprint = reviewsFingerprint(reviews);

  if (!force) {
    const cached = await prisma.gymReviewAnalysis.findUnique({ where: { gymId } });
    if (cached && cached.reviewsFingerprint === fingerprint) {
      return formatSummary(cached);
    }
  }

  const summary = await analyzeReviews(reviews, gym.name);
  return saveSummary(gymId, summary, fingerprint);
}

async function getGymReviewSummary(gymId, { refresh = false } = {}) {
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { id: true, isActive: true },
  });
  if (!gym || !gym.isActive) return null;

  if (refresh) {
    return refreshGymReviewAnalysis(gymId, { force: true });
  }

  const cached = await prisma.gymReviewAnalysis.findUnique({ where: { gymId } });
  const reviews = await loadReviews(gymId);
  const fingerprint = reviewsFingerprint(reviews);

  if (cached && cached.reviewsFingerprint === fingerprint) {
    return formatSummary(cached);
  }

  return refreshGymReviewAnalysis(gymId, { force: true });
}

function scheduleGymReviewAnalysisRefresh(gymId) {
  void refreshGymReviewAnalysis(gymId, { force: true }).catch((err) => {
    logger.warn({ err: err.message, gymId }, 'background gym review analysis failed');
  });
}

module.exports = {
  refreshGymReviewAnalysis,
  getGymReviewSummary,
  scheduleGymReviewAnalysisRefresh,
  analyzeReviews,
  computeStarSentiment,
  resolveReviewSentiment,
  aggregateSentimentLabels,
};
