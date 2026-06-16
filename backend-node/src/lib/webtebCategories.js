/**
 * WebTeb category slugs → Taqwin UI category ids (nutrition.cat.* translations).
 * Slugs discovered from https://www.webteb.com/nutritionfacts
 */
const { FDC_CATEGORIES } = require('./fdcCategories');

const SLUG_TO_TAQWIN_ID = {
  'dairy-and-egg-product': 'dairy-eggs',
  'dairy-and-egg-products': 'dairy-eggs',
  'dairy-egg': 'dairy-eggs',
  'dairy-eggs': 'dairy-eggs',
  'herbs-and-spices': 'herbs-spices',
  'spices-and-herbs': 'herbs-spices',
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
  snacks: 'snacks',
};

/** DB / WebTeb ids that differ from browse ids (sync with frontend nutritionCategoryTheme.ts). */
const CATEGORY_ID_ALIASES = {
  'spices-and-herbs': 'herbs-spices',
  'herbs-and-spices': 'herbs-spices',
  sausages: 'processed-meats',
  sausage: 'processed-meats',
};

const KNOWN_BROWSE_CATEGORY_IDS = new Set(FDC_CATEGORIES.map((c) => c.id));

/** WebTeb slugs excluded from import and browse (removed categories). */
const EXCLUDED_WEBTEB_CATEGORY_SLUGS = new Set([
  'meals-entrees-and-sidedishes',
  'meals-entrees-and-side-dishes',
]);

const ICON_BY_TAQWIN_ID = Object.fromEntries(FDC_CATEGORIES.map((c) => [c.id, c.icon]));

function resolveCategoryId(id) {
  return CATEGORY_ID_ALIASES[id] ?? id;
}

function isKnownBrowseCategoryId(id) {
  return KNOWN_BROWSE_CATEGORY_IDS.has(resolveCategoryId(id));
}

/** All DB `webteb_foods.category_id` values that belong to a browse tile id. */
function dbCategoryIdsForBrowseId(rawId) {
  const canonical = resolveCategoryId(taqwinIdForSlug(rawId) || rawId);
  const ids = new Set([rawId, canonical, taqwinIdForSlug(rawId)].filter(Boolean));
  for (const [alias, resolved] of Object.entries(CATEGORY_ID_ALIASES)) {
    if (resolved === canonical) ids.add(alias);
  }
  return [...ids];
}

function isExcludedWebtebSlug(slug) {
  const s = String(slug || '')
    .toLowerCase()
    .replace(/\/$/, '');
  return EXCLUDED_WEBTEB_CATEGORY_SLUGS.has(s);
}

function taqwinIdForSlug(slug) {
  const s = String(slug || '')
    .toLowerCase()
    .replace(/\/$/, '');
  if (SLUG_TO_TAQWIN_ID[s]) return SLUG_TO_TAQWIN_ID[s];
  for (const [key, id] of Object.entries(SLUG_TO_TAQWIN_ID)) {
    if (s.includes(key) || key.includes(s)) return id;
  }
  return s.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'other';
}

function iconForTaqwinId(id) {
  return ICON_BY_TAQWIN_ID[resolveCategoryId(id)] || 'restaurant';
}

/** Seed rows for WebtebCategory table (id = Taqwin category id). */
function buildCategorySeedRows(discovered) {
  const byId = new Map();
  for (const row of discovered) {
    if (isExcludedWebtebSlug(row.slug)) continue;
    const id = taqwinIdForSlug(row.slug);
    if (!isKnownBrowseCategoryId(id)) continue;
    if (!byId.has(id)) {
      byId.set(id, {
        id,
        slug: row.slug,
        nameAr: row.nameAr || row.slug,
        icon: iconForTaqwinId(id),
        sortOrder: byId.size,
      });
    }
  }
  return [...byId.values()];
}

module.exports = {
  SLUG_TO_TAQWIN_ID,
  EXCLUDED_WEBTEB_CATEGORY_SLUGS,
  isExcludedWebtebSlug,
  isKnownBrowseCategoryId,
  resolveCategoryId,
  dbCategoryIdsForBrowseId,
  taqwinIdForSlug,
  iconForTaqwinId,
  buildCategorySeedRows,
};
