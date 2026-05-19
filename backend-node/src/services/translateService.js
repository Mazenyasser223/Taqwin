/**
 * Lightweight EN→AR translation for dynamic USDA food labels (cached).
 */
const { sanitizeFoodName } = require('../lib/foodNameSanitize');
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

/** Common USDA food words/phrases → Arabic (comma-separated names translated in parts). */
const FOOD_TERM_AR = {
  yogurt: 'زبادي',
  plain: 'عادي',
  'whole milk': 'حليب كامل الدسم',
  milk: 'حليب',
  chicken: 'دجاج',
  breast: 'صدر',
  egg: 'بيض',
  eggs: 'بيض',
  rice: 'أرز',
  bread: 'خبز',
  beef: 'لحم بقر',
  fish: 'سمك',
  salmon: 'سلمون',
  oil: 'زيت',
  olive: 'زيتون',
  coconut: 'جوز الهند',
  butter: 'زبدة',
  cheese: 'جبن',
  apple: 'تفاح',
  banana: 'موز',
  tomato: 'طماطم',
  potato: 'بطاطس',
  raw: 'نيء',
  cooked: 'مطبوخ',
  boiled: 'مسلوق',
  fried: 'مقلي',
  grilled: 'مشوي',
};

function translateTermToAr(term) {
  const t = term.trim().toLowerCase();
  if (!t) return term;
  if (FOOD_TERM_AR[t]) return FOOD_TERM_AR[t];
  return null;
}

async function translateFoodName(text, targetLang, brandOwner = null) {
  const trimmed = sanitizeFoodName((text || '').trim(), { brandOwner });
  if (!trimmed || targetLang !== 'ar') return trimmed;

  const key = `ar:food:${trimmed.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const translated = [];
    for (const part of parts) {
      const staticAr = translateTermToAr(part);
      if (staticAr) {
        translated.push(staticAr);
      } else {
        try {
          translated.push(await translateOne(part, 'ar'));
        } catch {
          translated.push(part);
        }
      }
    }
    const joined = translated.join('، ');
    cacheSet(key, joined);
    return joined;
  }

  const staticFull = translateTermToAr(trimmed);
  if (staticFull) {
    cacheSet(key, staticFull);
    return staticFull;
  }

  try {
    const translated = await myMemoryTranslate(trimmed, targetLang);
    cacheSet(key, translated);
    return translated;
  } catch {
    return trimmed;
  }
}

async function translateOne(text, targetLang) {
  const trimmed = (text || '').trim();
  if (!trimmed || targetLang !== 'ar') return trimmed;

  const key = `ar:${trimmed.toLowerCase()}`;
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

  const concurrency = 8;
  let index = 0;
  async function worker() {
    while (index < unique.length) {
      const i = index++;
      const src = unique[i];
      map.set(src, await translateFoodName(src, targetLang));
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

module.exports = {
  translateOne,
  translateBatch,
  translateCategoryStatic,
  localizeFoodPreviews,
  CATEGORY_AR,
};
