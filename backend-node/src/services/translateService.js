/**
 * Lightweight EN→AR translation for dynamic USDA food labels (cached).
 */
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

/** Translate unique strings with modest concurrency. */
async function translateBatch(texts, targetLang = 'ar') {
  const unique = [...new Set(texts.map((t) => (t || '').trim()).filter(Boolean))];
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
      map.set(src, await translateOne(src, targetLang));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker));
  return map;
}

function translateCategoryStatic(category, targetLang = 'ar') {
  if (!category || targetLang !== 'ar') return category;
  return CATEGORY_AR[category] || null;
}

async function localizeFoodPreviews(foods, targetLang = 'ar') {
  if (targetLang !== 'ar' || !foods?.length) return foods;

  const names = foods.map((f) => f.name);
  const categoriesNeedingApi = [
    ...new Set(
      foods
        .map((f) => f.foodCategory)
        .filter((c) => c && !translateCategoryStatic(c, 'ar'))
    ),
  ];

  const [nameMap, categoryMap] = await Promise.all([
    translateBatch(names, 'ar'),
    translateBatch(categoriesNeedingApi, 'ar'),
  ]);

  return foods.map((f) => {
    const nameAr = nameMap.get(f.name) || f.name;
    let foodCategory = f.foodCategory;
    if (foodCategory) {
      foodCategory =
        translateCategoryStatic(foodCategory, 'ar') ||
        categoryMap.get(foodCategory) ||
        foodCategory;
    }
    return {
      ...f,
      nameEn: f.name,
      name: nameAr,
      foodCategoryEn: f.foodCategory,
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
