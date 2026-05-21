/**
 * WebTeb category slugs → Taqwin UI category ids (nutrition.cat.* translations).
 * Slugs discovered from https://www.webteb.com/nutritionfacts
 */
const SLUG_TO_TAQWIN_ID = {
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

const { FDC_CATEGORIES } = require('./fdcCategories');

const ICON_BY_TAQWIN_ID = Object.fromEntries(FDC_CATEGORIES.map((c) => [c.id, c.icon]));

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
  return ICON_BY_TAQWIN_ID[id] || 'restaurant';
}

/** Seed rows for WebtebCategory table (id = Taqwin category id). */
function buildCategorySeedRows(discovered) {
  const byId = new Map();
  for (const row of discovered) {
    const id = taqwinIdForSlug(row.slug);
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
  taqwinIdForSlug,
  iconForTaqwinId,
  buildCategorySeedRows,
};
