/**
 * Lightweight EN→AR translation for dynamic USDA food labels (cached).
 */
const { sanitizeFoodName } = require('../lib/foodNameSanitize');
const {
  containsLatin,
  lookupPhrase,
  lookupTerm,
  lookupNutrient,
  PHRASE_ENTRIES,
} = require('../lib/foodTermArabic');
const CATEGORY_AR = {
  'Confectionery Products': 'منتجات الحلويات',
  Chocolate: 'شوكولاتة',
  Candy: 'حلوى',
  'Dairy and Egg Products': 'منتجات الألبان والبيض',
  'Vegetables and Vegetable Products': 'خضروات',
  'Fruits and Fruit Juices': 'فواكه',
  'Poultry Products': 'دواجن',
  'Beef Products': 'لحوم بقر',
  'Pork Products': 'لحوم خنزير',
  'Sausages and Luncheon Meats': 'لحوم مصنعة',
  'Finfish and Shellfish Products': 'مأكولات بحرية',
  'Nut and Seed Products': 'مكسرات وبذور',
  'Legumes and Legume Products': 'بقوليات',
  'Cereal Grains and Pasta': 'حبوب ومعكرونة',
  'Baked Products': 'مخبوزات',
  Snacks: 'وجبات خفيفة',
  Beverages: 'مشروبات',
  'Fast Foods': 'وجبات سريعة',
  'Restaurant Foods': 'أطعمة مطاعم',
  'Baby Foods': 'أطعمة أطفال',
  'Soups, Sauces, and Gravies': 'شوربات وصلصات',
  'Spices and Herbs': 'توابل وأعشاب',
  'Fats and Oils': 'دهون وزيوت',
  'Breakfast Cereals': 'حبوب الإفطار',
  'Meals, Entrees, and Side Dishes': 'وجبات رئيسية',
  'Frozen Desserts': 'حلويات مجمدة',
  'Ice Cream and Frozen Yogurt': 'آيس كريم',
};

const cache = new Map();
const MAX_CACHE = 4000;

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function cacheSet(key, value) {
  if (cache.size >= MAX_CACHE) {
    const first = cache.keys().next().value;
    cache.delete(first);
  }
  cache.set(key, value);
}

async function myMemoryTranslate(text, targetLang) {
  const langpair = targetLang === 'ar' ? 'en|ar' : 'en|en';
  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', text.slice(0, 500));
  url.searchParams.set('langpair', langpair);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Translate ${res.status}`);
  const data = await res.json();
  const translated = data?.responseData?.translatedText;
  if (!translated || translated === text) return text;
  return translated;
}

function replacePhrasesInPart(part) {
  let lower = part.trim().toLowerCase();
  let out = part.trim();
  for (const [en, ar] of PHRASE_ENTRIES) {
    if (lower.includes(en)) {
      out = out.replace(new RegExp(en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ar);
      lower = out.toLowerCase();
    }
  }
  return out.trim();
}

async function translateWordsToAr(fragment) {
  const cleaned = replacePhrasesInPart(fragment);
  if (!containsLatin(cleaned)) return cleaned;

  const words = cleaned.split(/\s+/).filter(Boolean);
  const pieces = [];
  for (const word of words) {
    const staticWord = lookupTerm(word);
    if (staticWord != null && staticWord !== '') {
      pieces.push(staticWord);
      continue;
    }
    if (!containsLatin(word)) {
      pieces.push(word);
      continue;
    }
    try {
      pieces.push(await translateOne(word, 'ar'));
    } catch {
      pieces.push(word);
    }
  }
  return pieces.filter(Boolean).join(' ').trim();
}

async function translatePartToAr(part) {
  const trimmed = part.trim();
  if (!trimmed) return '';
  if (!containsLatin(trimmed)) return trimmed;

  const phrase = lookupPhrase(trimmed);
  if (phrase) return phrase;

  const phraseReplaced = replacePhrasesInPart(trimmed);
  if (!containsLatin(phraseReplaced)) return phraseReplaced;

  const staticTerm = lookupTerm(trimmed);
  if (staticTerm != null && staticTerm !== '') return staticTerm;

  let out = await translateWordsToAr(phraseReplaced);
  if (containsLatin(out)) {
    try {
      out = await translateOne(trimmed, 'ar');
    } catch {
      out = phraseReplaced;
    }
  }
  return out;
}

async function translateFoodName(text, targetLang, brandOwner = null) {
  const trimmed = sanitizeFoodName((text || '').trim(), { brandOwner });
  if (!trimmed || targetLang !== 'ar') return trimmed;

  const key = `ar:v3:food:${trimmed.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  let result = trimmed;
  try {
    const full = await myMemoryTranslate(trimmed, 'ar');
    if (full && !containsLatin(full)) {
      result = full;
    }
  } catch {
    /* part-by-part below */
  }

  if (containsLatin(result)) {
    const parts = trimmed.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
    const translated =
      parts.length > 1
        ? await Promise.all(parts.map((p) => translatePartToAr(p)))
        : [await translatePartToAr(trimmed)];
    result = translated.filter(Boolean).join('، ');
  }

  if (containsLatin(result)) {
    try {
      const retry = await myMemoryTranslate(result, 'ar');
      if (retry && !containsLatin(retry)) result = retry;
    } catch {
      /* keep best effort */
    }
  }

  result = result.replace(/\s+/g, ' ').replace(/،\s*،/g, '،').trim();
  cacheSet(key, result);
  return result;
}

async function translateNutrientName(name, targetLang = 'ar') {
  const trimmed = (name || '').trim();
  if (!trimmed || targetLang !== 'ar') return trimmed;

  const key = `ar:v3:nut:${trimmed.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const staticN = lookupNutrient(trimmed);
  if (staticN) {
    cacheSet(key, staticN);
    return staticN;
  }

  let out = trimmed;
  try {
    out = await translateOne(trimmed, 'ar');
  } catch {
    out = trimmed;
  }
  cacheSet(key, out);
  return out;
}

async function translateOne(text, targetLang) {
  const trimmed = (text || '').trim();
  if (!trimmed || targetLang !== 'ar') return trimmed;

  const key = `ar:v3:${trimmed.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  try {
    const translated = await myMemoryTranslate(trimmed, targetLang);
    cacheSet(key, translated);
    return translated;
  } catch {
    return trimmed;
  }
}

function coerceTranslateText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    const fromObj = value.description || value.name;
    if (typeof fromObj === 'string') return fromObj.trim();
  }
  return String(value).trim();
}

/** Translate unique strings with modest concurrency. */
async function translateBatch(texts, targetLang = 'ar') {
  const unique = [...new Set(texts.map((t) => coerceTranslateText(t)).filter(Boolean))];
  const map = new Map();
  if (targetLang !== 'ar' || unique.length === 0) {
    unique.forEach((t) => map.set(t, t));
    return map;
  }

  const concurrency = Number(process.env.FDC_TRANSLATE_CONCURRENCY) || 24;
  let index = 0;
  async function worker() {
    while (index < unique.length) {
      const i = index++;
      const src = unique[i];
      const text = src.startsWith('nut:') ? src.slice(4) : src;
      const out = src.startsWith('nut:')
        ? await translateNutrientName(text, targetLang)
        : await translateFoodName(text, targetLang);
      map.set(src, out);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker));
  return map;
}

function translateCategoryStatic(category, targetLang = 'ar') {
  if (!category || targetLang !== 'ar') return category;
  return CATEGORY_AR[category] || null;
}

async function localizeFoodPreviews(foods, targetLang = 'en') {
  if (!foods?.length) return foods;

  const normalized = foods.map((f) => {
    const brandOwner = f.brandOwner || null;
    const nameEn = sanitizeFoodName(f.nameEn || f.name, { brandOwner });
    return {
      ...f,
      nameEn,
      foodCategoryEn: f.foodCategoryEn || f.foodCategory,
    };
  });

  if (targetLang === 'en') {
    return normalized.map((f) => ({
      ...f,
      name: f.nameEn,
      foodCategory: f.foodCategoryEn ?? f.foodCategory,
    }));
  }

  if (targetLang !== 'ar') return normalized;

  const categoriesNeedingApi = [
    ...new Set(
      normalized
        .map((f) => f.foodCategoryEn || f.foodCategory)
        .filter((c) => c && !translateCategoryStatic(c, 'ar')),
    ),
  ];

  const names = normalized.map((f) => f.nameEn);
  const [nameMap, categoryMap] = await Promise.all([
    translateBatch(names, 'ar'),
    translateBatch(categoriesNeedingApi, 'ar'),
  ]);

  return normalized.map((f) => {
    const catSrc = f.foodCategoryEn || f.foodCategory;
    let foodCategory = catSrc;
    if (catSrc) {
      foodCategory =
        translateCategoryStatic(catSrc, 'ar') || categoryMap.get(catSrc) || catSrc;
    }
    const translated = nameMap.get(f.nameEn) || f.nameEn;
    return {
      ...f,
      name: sanitizeFoodName(translated, { brandOwner: f.brandOwner }),
      foodCategory,
    };
  });
}

async function localizeNutrientRows(rows, targetLang = 'ar') {
  if (!rows?.length || targetLang !== 'ar') return rows;
  const unique = [...new Set(rows.map((r) => r.name).filter(Boolean))];
  const map = new Map();
  await Promise.all(
    unique.map(async (n) => {
      map.set(n, await translateNutrientName(n, 'ar'));
    })
  );
  return rows.map((r) => {
    const name = map.get(r.name) || r.name;
    return { ...r, name: containsLatin(name) ? lookupNutrient(r.name) || name : name };
  });
}

async function localizeFoodDetails(details, targetLang = 'en') {
  if (!details || targetLang !== 'ar') return details;

  const [localized] = await localizeFoodPreviews(
    [
      {
        fdcId: details.fdcId,
        name: details.name,
        nameEn: details.nameEn || details.name,
        dataType: details.dataType,
        brandOwner: null,
        foodCategory: details.foodCategory,
        foodCategoryEn: details.foodCategoryEn || details.foodCategory,
        calories: details.macros?.calories ?? 0,
        protein: details.macros?.protein ?? 0,
        carbs: details.macros?.carbs ?? 0,
        fat: details.macros?.fat ?? 0,
      },
    ],
    'ar'
  );

  const vitamins = await localizeNutrientRows(details.vitamins, 'ar');
  const minerals = await localizeNutrientRows(details.minerals, 'ar');
  const other = await localizeNutrientRows(details.other, 'ar');

  let servingLabel = details.servingLabel;
  if (servingLabel && containsLatin(servingLabel)) {
    try {
      servingLabel = await translateOne(servingLabel, 'ar');
    } catch {
      servingLabel = details.servingLabel;
    }
  }

  return {
    ...details,
    name: localized?.name ?? details.name,
    foodCategory: localized?.foodCategory ?? details.foodCategory,
    vitamins,
    minerals,
    other,
    servingLabel,
  };
}

/** Arabic (or other) → English for USDA FDC search queries. */
async function translateToEnglish(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return trimmed;

  const key = `en:search:${trimmed.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', trimmed.slice(0, 500));
  url.searchParams.set('langpair', 'ar|en');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Translate ${res.status}`);
  const data = await res.json();
  const translated = data?.responseData?.translatedText;
  const out = translated && translated !== trimmed ? translated : trimmed;
  cacheSet(key, out);
  return out;
}

module.exports = {
  translateOne,
  translateBatch,
  translateCategoryStatic,
  translateFoodName,
  translateNutrientName,
  localizeFoodPreviews,
  localizeFoodDetails,
  localizeNutrientRows,
  translateToEnglish,
  CATEGORY_AR,
};
