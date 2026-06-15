/**
 * Frequently Bought Together — computed from real OrderItems co-occurrence.
 */
const { prisma } = require('../../db');
const { normalizeProduct } = require('../shopProduct');
const { rankProducts } = require('./productRanking');

const PRODUCT_SELECT = {
  id: true,
  slug: true,
  name: true,
  nameAr: true,
  brand: true,
  categoryId: true,
  price: true,
  compareAtPrice: true,
  currency: true,
  discountPercent: true,
  priceMin: true,
  priceMax: true,
  hasVariants: true,
  imageUrl: true,
  stock: true,
  costPrice: true,
  avgRating: true,
  salesCount: true,
  isOnSale: true,
  isFeatured: true,
  isActive: true,
  sortOrder: true,
  category: {
    select: {
      id: true,
      slug: true,
      nameEn: true,
      nameAr: true,
      icon: true,
      parentId: true,
    },
  },
};

/**
 * @param {string} anchorProductId
 * @param {{ limit?: number, excludeIds?: string[] }} [opts]
 */
async function getFrequentlyBoughtTogether(anchorProductId, opts = {}) {
  const limit = Math.min(Math.max(opts.limit ?? 3, 1), 6);
  const exclude = new Set(opts.excludeIds || []);
  exclude.add(anchorProductId);

  const paidOrders = await prisma.order.findMany({
    where: {
      paymentStatus: 'paid',
      items: { some: { productId: anchorProductId } },
    },
    select: {
      items: { select: { productId: true } },
    },
    take: 500,
    orderBy: { createdAt: 'desc' },
  });

  const counts = new Map();
  for (const order of paidOrders) {
    const ids = (order.items || []).map((i) => i.productId).filter(Boolean);
    if (!ids.includes(anchorProductId)) continue;
    for (const pid of ids) {
      if (pid === anchorProductId || exclude.has(pid)) continue;
      counts.set(pid, (counts.get(pid) || 0) + 1);
    }
  }

  const rankedIds = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit * 2)
    .map(([id]) => id);

  if (!rankedIds.length) return [];

  const rows = await prisma.product.findMany({
    where: {
      id: { in: rankedIds },
      isActive: true,
      stock: { gt: 0 },
    },
    select: PRODUCT_SELECT,
  });

  const scored = rankProducts(rows, { slot: 'fbt', goalKey: 'muscle' });
  return scored.slice(0, limit).map(({ product, score }) => ({
    product: normalizeProduct(product),
    coOccurrenceCount: counts.get(product.id) || 0,
    score,
  }));
}

module.exports = { getFrequentlyBoughtTogether, PRODUCT_SELECT };
