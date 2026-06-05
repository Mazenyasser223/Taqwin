/**
 * Pick the best WooCommerce category slug for a product (matches MFB browse filters).
 */

const ROOT_PRIORITY = [
  'offers-and-discounts',
  'massage-equipment',
  'medical-equipment',
  'bags',
  'clothing',
  'kitchen',
  'pharmacy',
  'healthy-groceries',
  'supplements',
  'sports-equipment',
];

/**
 * @param {Array<{ slug: string, parent?: number }>} mfbCategories - full MFB category list with id/parent
 * @returns {{ parentSlugBySlug: Map<string, string|null>, depthBySlug: Map<string, number> }}
 */
function buildCategoryMaps(mfbCategories) {
  const byId = new Map(mfbCategories.map((c) => [c.id, c]));
  const parentSlugBySlug = new Map();

  for (const cat of mfbCategories) {
    const parent = cat.parent ? byId.get(cat.parent) : null;
    parentSlugBySlug.set(cat.slug, parent?.slug ?? null);
  }

  const depthBySlug = new Map();
  function depth(slug) {
    if (depthBySlug.has(slug)) return depthBySlug.get(slug);
    const parent = parentSlugBySlug.get(slug);
    const d = parent ? depth(parent) + 1 : 0;
    depthBySlug.set(slug, d);
    return d;
  }
  for (const cat of mfbCategories) depth(cat.slug);

  function isAncestor(ancestorSlug, descSlug) {
    let cur = descSlug;
    while (cur) {
      if (cur === ancestorSlug) return true;
      cur = parentSlugBySlug.get(cur) ?? null;
    }
    return false;
  }

  return { parentSlugBySlug, depthBySlug, isAncestor };
}

/**
 * @param {Array<{ slug: string }>|undefined} productCategories
 * @param {Map<string, string>} slugToCategoryId - known slugs in our DB
 * @param {{ isAncestor: Function, depthBySlug: Map<string, number> }} maps
 */
function pickProductCategorySlug(productCategories, slugToCategoryId, maps) {
  const slugs = (productCategories || [])
    .map((c) => c.slug)
    .filter((s) => slugToCategoryId.has(s));
  if (!slugs.length) return null;

  let candidates = slugs.filter(
    (s) => !slugs.some((other) => other !== s && maps.isAncestor(s, other))
  );
  if (!candidates.length) candidates = slugs;

  for (const root of ROOT_PRIORITY) {
    if (candidates.includes(root)) return root;
  }

  let best = candidates[0];
  let bestDepth = maps.depthBySlug.get(best) ?? 0;
  for (const s of candidates) {
    const d = maps.depthBySlug.get(s) ?? 0;
    if (d > bestDepth) {
      bestDepth = d;
      best = s;
    }
  }
  return best;
}

module.exports = {
  ROOT_PRIORITY,
  buildCategoryMaps,
  pickProductCategorySlug,
};
