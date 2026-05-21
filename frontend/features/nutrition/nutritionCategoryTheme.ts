/** Maps DB ids that differ from i18n keys to Taqwin category ids. */
const CATEGORY_ID_ALIASES: Record<string, string> = {
  'spices-and-herbs': 'herbs-spices',
  'herbs-and-spices': 'herbs-spices',
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
