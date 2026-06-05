/** Maps DB ids that differ from i18n keys to Taqwin category ids. */
const CATEGORY_ID_ALIASES: Record<string, string> = {
  'spices-and-herbs': 'herbs-spices',
  'herbs-and-spices': 'herbs-spices',
  sausages: 'processed-meats',
  sausage: 'processed-meats',
};

/** WebTeb slugs → Taqwin `nutrition.cat.*` ids (keep in sync with backend webtebCategories.js). */
const WEBTEB_SLUG_TO_TAQWIN_ID: Record<string, string> = {
  'dairy-and-egg-product': 'dairy-eggs',
  'dairy-and-egg-products': 'dairy-eggs',
  'dairy-egg': 'dairy-eggs',
  'dairy-eggs': 'dairy-eggs',
  'herbs-and-spices': 'herbs-spices',
  'fats-and-oils': 'fats-oils',
  'poultry-products': 'poultry',
  poultry: 'poultry',
  'soups-sauces-and-gravies': 'soups-broths',
  soups: 'soups-broths',
  'processed-meats': 'processed-meats',
  sausages: 'processed-meats',
  sausage: 'processed-meats',
  'luncheon-meats': 'processed-meats',
  'breakfast-cereals': 'breakfast-cereals',
  'fruits-and-fruit-juices': 'fruits-juices',
  'fruits-and-juices': 'fruits-juices',
  vegetables: 'vegetables',
  'nut-and-seed-products': 'nuts-seeds',
  'nut-and-seed': 'nuts-seeds',
  beef: 'beef',
  beverages: 'beverages',
  'finfish-and-shellfish-products': 'seafood',
  seafood: 'seafood',
  'legumes-and-legume-products': 'legumes',
  legumes: 'legumes',
  'lamb-veal-and-game': 'lamb-veal',
  'lamb-veal': 'lamb-veal',
  'baked-products': 'bakery',
  bakery: 'bakery',
  sweets: 'sweets',
  'cereal-grains-and-pasta': 'grains-pasta',
  'fast-foods': 'fast-food',
  'fast-food': 'fast-food',
  'meals-entrees-and-sidedishes': 'meals-sandwiches',
  'meals-entrees-and-side-dishes': 'meals-sandwiches',
  snacks: 'snacks',
};

/** Accent colors for category icons on photo tiles */
const CATEGORY_TILE_CLASS: Record<string, string> = {
  'dairy-eggs': 'text-sky-300',
  'fats-oils': 'text-amber-300',
  'soups-broths': 'text-orange-300',
  'breakfast-cereals': 'text-yellow-200',
  vegetables: 'text-emerald-300',
  beef: 'text-red-300',
  seafood: 'text-cyan-300',
  'lamb-veal': 'text-rose-300',
  sweets: 'text-pink-300',
  'fast-food': 'text-orange-300',
  snacks: 'text-lime-300',
  'herbs-spices': 'text-green-300',
  poultry: 'text-amber-200',
  'processed-meats': 'text-red-200',
  'fruits-juices': 'text-fuchsia-300',
  'nuts-seeds': 'text-yellow-200',
  beverages: 'text-blue-300',
  legumes: 'text-teal-300',
  bakery: 'text-amber-200',
  'grains-pasta': 'text-stone-300',
  'meals-sandwiches': 'text-violet-300',
};

export const CATEGORY_IMAGE_DIR = '/nutrition/categories';

const LOCAL_EXT = ['.webp', '.jpg', '.jpeg', '.png'] as const;

/** Unsplash fallbacks when local file is missing */
const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  'dairy-eggs':
    'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=800&q=80',
  'fats-oils':
    'https://images.unsplash.com/photo-1474979266408-7eaacbcd87c5?auto=format&fit=crop&w=800&q=80',
  'soups-broths':
    'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80',
  'breakfast-cereals':
    'https://images.unsplash.com/photo-1517673400267-025144a75bb9?auto=format&fit=crop&w=800&q=80',
  vegetables:
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
  beef:
    'https://images.unsplash.com/photo-1603048297172-c92544798d5a?auto=format&fit=crop&w=800&q=80',
  seafood:
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=800&q=80',
  'lamb-veal':
    'https://images.unsplash.com/photo-1602470520998-fb9e8e1c9352?auto=format&fit=crop&w=800&q=80',
  sweets:
    'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=80',
  'fast-food':
    'https://images.unsplash.com/photo-1561758033-d65ebe7788a1?auto=format&fit=crop&w=800&q=80',
  snacks:
    'https://images.unsplash.com/photo-1613919113640-25732ed5c456?auto=format&fit=crop&w=800&q=80',
  'herbs-spices':
    'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
  poultry:
    'https://images.unsplash.com/photo-1583511655857-d18969a80065?auto=format&fit=crop&w=800&q=80',
  'processed-meats':
    'https://images.unsplash.com/photo-1528607929212-263ea9b8d0a4?auto=format&fit=crop&w=800&q=80',
  'fruits-juices':
    'https://images.unsplash.com/photo-1619566699813-4f4271f25d48?auto=format&fit=crop&w=800&q=80',
  'nuts-seeds':
    'https://images.unsplash.com/photo-1599599810769-bcde5a160d88?auto=format&fit=crop&w=800&q=80',
  beverages:
    'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=800&q=80',
  legumes:
    'https://images.unsplash.com/photo-1586201375767-2b046c332c9b?auto=format&fit=crop&w=800&q=80',
  bakery:
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
  'grains-pasta':
    'https://images.unsplash.com/photo-1473093296815-af2e27e8780e?auto=format&fit=crop&w=800&q=80',
  'meals-sandwiches':
    'https://images.unsplash.com/photo-1528735602780-2552fd46c207?auto=format&fit=crop&w=800&q=80',
};

const DEFAULT_CATEGORY_IMAGE =
  'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=80';

export function resolveCategoryId(id: string): string {
  return CATEGORY_ID_ALIASES[id] ?? id;
}

/** Normalize API category id or WebTeb slug to a Taqwin translation key id. */
export function taqwinIdFromSlug(slug: string): string {
  const s = String(slug || '')
    .toLowerCase()
    .replace(/\/$/, '');
  if (WEBTEB_SLUG_TO_TAQWIN_ID[s]) return WEBTEB_SLUG_TO_TAQWIN_ID[s];
  for (const [key, id] of Object.entries(WEBTEB_SLUG_TO_TAQWIN_ID)) {
    if (s.includes(key) || key.includes(s)) return id;
  }
  return resolveCategoryId(s.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'other');
}

/** Arabic WebTeb category titles → Taqwin i18n ids (sync with nutrition.cat.* ar strings). */
const AR_CATEGORY_NAME_TO_TAQWIN_ID: Record<string, string> = {
  'الالبان والبيض': 'dairy-eggs',
  'الدهون والزيوت': 'fats-oils',
  'الحساء والمرقات': 'soups-broths',
  'حبوب الإفطار': 'breakfast-cereals',
  'حبوب الافطار': 'breakfast-cereals',
  الخضروات: 'vegetables',
  'منتجات لحم البقر': 'beef',
  'مأكولات بحرية': 'seafood',
  'لحم الخروف والعجل': 'lamb-veal',
  الحلويات: 'sweets',
  'الوجبات السريعة': 'fast-food',
  المسليات: 'snacks',
  'الأعشاب والتوابل': 'herbs-spices',
  'منتجات الدواجن': 'poultry',
  'اللحوم المصنعة': 'processed-meats',
  'اللحوم المصنعه': 'processed-meats',
  'الفواكه والعصائر': 'fruits-juices',
  'الجوز ومنتجات البذور': 'nuts-seeds',
  المشروبات: 'beverages',
  'البقوليات ومنتجاتها': 'legumes',
  'منتجات المخبوزات': 'bakery',
  'الحبوب والباستا': 'grains-pasta',
  'وجبات، مقبلات، شطائر': 'meals-sandwiches',
};

function normalizeArabicCategoryName(name: string): string {
  return name
    .replace(/\u0640/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

export function taqwinIdFromArabicName(nameAr: string): string | null {
  const raw = (nameAr || '').trim();
  if (!raw) return null;
  if (AR_CATEGORY_NAME_TO_TAQWIN_ID[raw]) return AR_CATEGORY_NAME_TO_TAQWIN_ID[raw];
  const n = normalizeArabicCategoryName(raw);
  if (AR_CATEGORY_NAME_TO_TAQWIN_ID[n]) return AR_CATEGORY_NAME_TO_TAQWIN_ID[n];
  for (const [ar, id] of Object.entries(AR_CATEGORY_NAME_TO_TAQWIN_ID)) {
    const key = normalizeArabicCategoryName(ar);
    if (n === key || n.includes(key) || key.includes(n)) return id;
  }
  return null;
}

export function categoryLookupIds(
  categoryId?: string | null,
  slug?: string | null,
  fromArabic?: string | null
): string[] {
  const out: string[] = [];
  const add = (raw?: string | null) => {
    if (!raw) return;
    for (const id of [resolveCategoryId(raw), taqwinIdFromSlug(raw), raw]) {
      if (id && !out.includes(id)) out.push(id);
    }
  };
  add(categoryId);
  if (slug && slug !== categoryId) add(slug);
  if (fromArabic && !out.includes(fromArabic)) out.unshift(fromArabic);
  return out;
}

export function categoryTileClass(id: string): string {
  const key = resolveCategoryId(id);
  return CATEGORY_TILE_CLASS[key] ?? 'text-accent';
}

function localPathsForId(id: string): string[] {
  const key = resolveCategoryId(id);
  const ids = key === id ? [id] : [id, key];
  const paths: string[] = [];
  for (const catId of ids) {
    for (const ext of LOCAL_EXT) {
      paths.push(`${CATEGORY_IMAGE_DIR}/${catId}${ext}`);
    }
  }
  return paths;
}

/** Local files first, then Unsplash fallback (deduped). */
export function categoryImageCandidates(id: string): string[] {
  const key = resolveCategoryId(id);
  const fallback = CATEGORY_FALLBACK_IMAGES[key] ?? DEFAULT_CATEGORY_IMAGE;
  const list = [...localPathsForId(id), fallback];
  return [...new Set(list)];
}

export function categoryImageUrl(id: string): string {
  return categoryImageCandidates(id)[0];
}
