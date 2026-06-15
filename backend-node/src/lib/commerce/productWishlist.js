/**
 * Product wishlist — save for later + admin most-wishlisted stats.
 */
const { prisma } = require('../../db');
const { normalizeProduct } = require('../shopProduct');

const listProductSelect = {
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
  imageUrl: true,
  stock: true,
  isOnSale: true,
  isFeatured: true,
  isActive: true,
  avgRating: true,
  reviewCount: true,
  wishlistCount: true,
};

async function listUserWishlist(userId) {
  const rows = await prisma.productWishlist.findMany({
    where: { userId },
    include: { product: { select: listProductSelect } },
    orderBy: { createdAt: 'desc' },
  });
  return rows
    .filter((r) => r.product?.isActive !== false)
    .map((r) => ({
      id: r.id,
      productId: r.productId,
      createdAt: r.createdAt,
      product: normalizeProduct(r.product),
    }));
}

async function addToWishlist(userId, productId) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, isActive: true },
  });
  if (!product?.isActive) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }

  const existing = await prisma.productWishlist.findUnique({
    where: { userId_productId: { userId, productId } },
  });
  if (existing) return { id: existing.id, productId, alreadySaved: true };

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.productWishlist.create({
      data: { userId, productId },
    });
    await tx.product.update({
      where: { id: productId },
      data: { wishlistCount: { increment: 1 } },
    });
    return created;
  });

  return { id: row.id, productId, alreadySaved: false };
}

async function removeFromWishlist(userId, productId) {
  const existing = await prisma.productWishlist.findUnique({
    where: { userId_productId: { userId, productId } },
  });
  if (!existing) return { removed: false };

  await prisma.$transaction(async (tx) => {
    await tx.productWishlist.delete({ where: { id: existing.id } });
    await tx.product.updateMany({
      where: { id: productId, wishlistCount: { gt: 0 } },
      data: { wishlistCount: { decrement: 1 } },
    });
  });
  return { removed: true };
}

async function isProductWishlisted(userId, productId) {
  const row = await prisma.productWishlist.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { id: true },
  });
  return Boolean(row);
}

async function getWishlistProductIds(userId) {
  const rows = await prisma.productWishlist.findMany({
    where: { userId },
    select: { productId: true },
  });
  return new Set(rows.map((r) => r.productId));
}

/**
 * Admin — top wishlisted products.
 * @param {{ limit?: number }} [opts]
 */
async function getMostWishlistedProducts(opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 10, 1), 50);
  const products = await prisma.product.findMany({
    where: { isActive: true, wishlistCount: { gt: 0 } },
    select: {
      id: true,
      name: true,
      nameAr: true,
      price: true,
      imageUrl: true,
      wishlistCount: true,
      salesCount: true,
      avgRating: true,
    },
    orderBy: [{ wishlistCount: 'desc' }, { salesCount: 'desc' }],
    take: limit,
  });
  return products;
}

module.exports = {
  listUserWishlist,
  addToWishlist,
  removeFromWishlist,
  isProductWishlisted,
  getWishlistProductIds,
  getMostWishlistedProducts,
};
