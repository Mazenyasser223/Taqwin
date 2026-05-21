/**
 * Resolve user search text (Arabic / English / typos) to USDA-friendly English queries.
 */
const RESOLVE_CACHE_MAX = Number(process.env.FDC_RESOLVE_CACHE_MAX) || 500;
const RESOLVE_CACHE_TTL_MS = Number(process.env.FDC_RESOLVE_CACHE_TTL_MS) || 30 * 60 * 1000;
const resolveCache = new Map();

function getResolveCached(key) {
  const hit = resolveCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    resolveCache.delete(key);
    return null;
  }
  return hit.value;
}

function setResolveCached(key, value) {
  if (resolveCache.size >= RESOLVE_CACHE_MAX) {
    const oldest = resolveCache.keys().next().value;
    resolveCache.delete(oldest);
  }
  resolveCache.set(key, { value, expiresAt: Date.now() + RESOLVE_CACHE_TTL_MS });
}

const AR_TYPO = {
  بيص: 'بيض',
  بيد: 'بيض',
  بيضه: 'بيض',
  بيضة: 'بيض',
  دجاجه: 'دجاج',
  دجاجة: 'دجاج',
  فراخه: 'فراخ',
  لحمه: 'لحم',
  لحمة: 'لحم',
  سمكه: 'سمك',
  سمكة: 'سمك',
  جبنه: 'جبن',
  جبنة: 'جبن',
  حليبه: 'حليب',
  البان: 'حليب',
  بان: 'حليب',
  لبان: 'حليب',
  زبادى: 'زبادي',
  يوقرت: 'زبادي',
  كريمه: 'كريمة',
  قشطه: 'قشطة',
  ارز: 'أرز',
  خبزه: 'خبز',
  خبزة: 'خبز',
  تفاحه: 'تفاح',
  تفاحة: 'تفاح',
  موزه: 'موز',
  موزة: 'موز',
};

/** Arabic food token → English USDA search terms */
const AR_FOOD_EN = {
  بيض: 'egg eggs',
  بياض: 'egg white',
  صفار: 'egg yolk',
  دجاج: 'chicken poultry',
  فراخ: 'chicken poultry',
  لحم: 'beef meat',
  'لحم بقر': 'beef steak',
  'لحم بقري': 'beef',
  بقر: 'beef',
  عجل: 'veal',
  خروف: 'lamb',
  ضأن: 'lamb mutton',
  سمك: 'fish seafood',
  سلمون: 'salmon fish',
  تونة: 'tuna fish',
  جمبري: 'shrimp seafood',
  أرز: 'rice',
  رز: 'rice',
  معكرونة: 'pasta',
  مكرونة: 'pasta',
  خبز: 'bread bakery',
  حليب: 'milk dairy',
  لبن: 'milk yogurt',
  البان: 'milk dairy',
  بان: 'milk dairy',
  ألبان: 'milk dairy',
  زبادي: 'yogurt dairy',
  زبادى: 'yogurt dairy',
  قشطة: 'cream dairy',
  كريمة: 'cream dairy',
  'لبن زبادي': 'yogurt',
  جبن: 'cheese dairy',
  زبدة: 'butter',
  زيت: 'oil cooking',
  'زيت زيتون': 'olive oil',
  طماطم: 'tomato',
  بطاطس: 'potato',
  بطاطا: 'potato',
  خضار: 'vegetables',
  خضروات: 'vegetables fresh',
  فواكه: 'fruit',
  تفاح: 'apple fruit',
  موز: 'banana fruit',
  برتقال: 'orange fruit',
  عدس: 'lentils legumes',
  فول: 'beans legumes',
  حمص: 'chickpeas legumes',
  لوز: 'almonds nuts',
  'فول سوداني': 'peanut',
  شوفان: 'oats cereal',
  عسل: 'honey',
  سكر: 'sugar',
  ملح: 'salt',
  قهوة: 'coffee beverage',
  شاي: 'tea beverage',
  ماء: 'water beverage',
  'لحم مفروم': 'ground beef',
  'صدر دجاج': 'chicken breast',
  'فخذ دجاج': 'chicken thigh',
};

const EN_TYPO = {
  chiken: 'chicken',
  chikcen: 'chicken',
  egss: 'eggs',
  egs: 'eggs',
  eg: 'egg',
  milke: 'milk',
  milik: 'milk',
  yougurt: 'yogurt',
  yogart: 'yogurt',
  yoghurt: 'yogurt',
  chese: 'cheese',
  chees: 'cheese',
  tomatos: 'tomato',
  patato: 'potato',
  beaf: 'beef',
  cheeze: 'cheese',
};

function normalizeArabic(text) {
  return String(text)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(row[j] + 1, prev + 1, row[j - 1] + cost);
      row[j - 1] = prev;
      prev = next;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

function fuzzyMatchArabicFood(token) {
  const keys = Object.keys(AR_FOOD_EN);
  let best = null;
  let bestDist = token.length <= 3 ? 2 : 3;
  for (const key of keys) {
    if (key.length < 2 || token.length < 2) continue;
    if (Math.abs(key.length - token.length) > bestDist) continue;
    const d = levenshtein(token, key);
    if (d < bestDist) {
      bestDist = d;
      best = key;
    }
  }
  return best;
}

function mapArabicToken(raw) {
  let token = normalizeArabic(raw);
  if (!token) return null;
  token = AR_TYPO[token] || token;
  if (AR_FOOD_EN[token]) return AR_FOOD_EN[token];
  const fuzzy = fuzzyMatchArabicFood(token);
  if (fuzzy) return AR_FOOD_EN[fuzzy];
  return null;
}

function mapEnglishToken(raw) {
  const token = raw.trim().toLowerCase();
  if (!token) return null;
  if (EN_TYPO[token]) return EN_TYPO[token];
  return token;
}

function hasArabicScript(text) {
  return /[\u0600-\u06FF]/.test(text);
}

/**
 * @param {string} userQ
 * @param {{ translateFn?: (text: string) => Promise<string> }} [opts]
 */
async function resolveUserSearchQueryInner(userQ, opts = {}) {
  const trimmed = (userQ || '').trim();
  if (!trimmed) return '';

  if (hasArabicScript(trimmed)) {
    const normalized = normalizeArabic(trimmed);
    const tokens = normalized.split(/\s+/).filter(Boolean);
    const englishParts = [];

    for (const raw of tokens) {
      const mapped = mapArabicToken(raw);
      if (mapped) englishParts.push(mapped);
    }

    if (englishParts.length > 0) {
      return [...new Set(englishParts.join(' ').split(/\s+/))].join(' ');
    }

    if (typeof opts.translateFn === 'function') {
      try {
        const translated = await opts.translateFn(trimmed);
        if (translated && translated.trim()) return translated.trim();
      } catch {
        /* fall through */
      }
    }

    return trimmed;
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  return tokens.map(mapEnglishToken).filter(Boolean).join(' ') || trimmed;
}

async function resolveUserSearchQuery(userQ, opts = {}) {
  const trimmed = (userQ || '').trim();
  if (!trimmed) return '';

  const cacheKey = trimmed.toLowerCase();
  const cached = getResolveCached(cacheKey);
  if (cached != null) return cached;

  const resolved = await resolveUserSearchQueryInner(trimmed, opts);
  setResolveCached(cacheKey, resolved);
  return resolved;
}

function minSearchLength(userQ) {
  return (userQ || '').trim().length > 0 ? 1 : 0;
}

module.exports = {
  resolveUserSearchQuery,
  minSearchLength,
  hasArabicScript,
  normalizeArabic,
};
