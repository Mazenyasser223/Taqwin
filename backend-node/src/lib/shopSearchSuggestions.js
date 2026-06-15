const { prisma } = require('../db');

const DEFAULT_LIMIT = 6;

function normalizeQuery(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function productSearchQuery(product) {
  if (product.category?.nameEn) return product.category.nameEn;
  const token = String(product.name || '')
    .split(/[\s—–\-]+/)
    .find((part) => part.length > 2);
  return token || product.name;
}

function pushSuggestion(list, seen, item) {
  const query = String(item.query || '').trim();
  if (!query) return;
  const key = normalizeQuery(query);
  if (seen.has(key)) return;
  seen.add(key);
  list.push({
    labelEn: item.labelEn || query,
    labelAr: item.labelAr || item.labelEn || query,
    query,
  });
}

/**
 * Popular search terms derived from live catalog: featured products,
 * leaf categories with inventory, and top brands.
 */
async function getShopSearchSuggestions(limit = DEFAULT_LIMIT) {
  const suggestions = [];
  const seen = new Set();

  const [featured, leafCategories, brandRows] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, isFeatured: true },
      select: {
        name: true,
        nameAr: true,
        brand: true,
        sortOrder: true,
        category: { select: { nameEn: true, nameAr: true, slug: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      take: Math.max(limit, 4),
    }),
    prisma.shopCategory.findMany({
      where: {
        parentId: { not: null },
        products: { some: { isActive: true } },
      },
      select: {
        nameEn: true,
        nameAr: true,
        sortOrder: true,
        _count: { select: { products: { where: { isActive: true } } } },
      },
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    }),
    prisma.product.groupBy({
      by: ['brand'],
      where: { isActive: true, brand: { not: '' } },
      _count: { _all: true },
      orderBy: { _count: { brand: 'desc' } },
      take: Math.max(limit, 4),
    }),
  ]);

  for (const product of featured) {
    pushSuggestion(suggestions, seen, {
      labelEn: product.name,
      labelAr: product.nameAr || product.name,
      query: productSearchQuery(product),
    });
    if (suggestions.length >= limit) return suggestions;
  }

  const sortedCategories = [...leafCategories].sort(
    (a, b) => b._count.products - a._count.products || a.sortOrder - b.sortOrder,
  );

  for (const cat of sortedCategories) {
    pushSuggestion(suggestions, seen, {
      labelEn: cat.nameEn,
      labelAr: cat.nameAr || cat.nameEn,
      query: cat.nameEn,
    });
    if (suggestions.length >= limit) return suggestions;
  }

  for (const row of brandRows) {
    if (!row.brand) continue;
    pushSuggestion(suggestions, seen, {
      labelEn: row.brand,
      labelAr: row.brand,
      query: row.brand,
    });
    if (suggestions.length >= limit) return suggestions;
  }

  return suggestions;
}

module.exports = { getShopSearchSuggestions, DEFAULT_LIMIT };
