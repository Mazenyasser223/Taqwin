/**
 * Product reviews — verified purchase only, aggregate avgRating on Product.
 */
const { prisma } = require('../../db');

async function userHasVerifiedPurchase(userId, productId) {
  const order = await prisma.order.findFirst({
    where: {
      userId,
      paymentStatus: 'paid',
      items: { some: { productId } },
    },
    orderBy: { paidAt: 'desc' },
    select: { id: true },
  });
  return order?.id ?? null;
}

async function refreshProductRating(productId) {
  const agg = await prisma.productReview.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: { id: true },
  });
  await prisma.product.update({
    where: { id: productId },
    data: {
      avgRating: agg._avg.rating ?? 0,
      reviewCount: agg._count.id ?? 0,
    },
  });
  return {
    avgRating: agg._avg.rating ?? 0,
    reviewCount: agg._count.id ?? 0,
  };
}

/**
 * @param {string} productId
 * @param {{ page?: number, limit?: number }} [opts]
 */
async function listProductReviews(productId, opts = {}) {
  const page = Math.max(1, Number(opts.page) || 1);
  const limit = Math.min(Math.max(Number(opts.limit) || 10, 1), 50);
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    prisma.productReview.count({ where: { productId } }),
    prisma.productReview.findMany({
      where: { productId },
      include: {
        user: {
          select: {
            id: true,
            athleteProfile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
      orderBy: [{ helpfulCount: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.id,
      productId: r.productId,
      userId: r.userId,
      rating: r.rating,
      title: r.title,
      body: r.body,
      isVerifiedPurchase: r.isVerifiedPurchase,
      helpfulCount: r.helpfulCount,
      createdAt: r.createdAt,
      user: r.user
        ? {
            id: r.user.id,
            name: r.user.athleteProfile?.displayName ?? null,
            avatarUrl: r.user.athleteProfile?.avatarUrl ?? null,
          }
        : null,
    })),
    total,
    page,
    perPage: limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function createProductReview(userId, productId, data) {
  const rating = Math.floor(Number(data.rating));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    const err = new Error('Rating must be between 1 and 5');
    err.status = 400;
    throw err;
  }

  const body = String(data.body || '').trim();
  if (body.length < 10) {
    const err = new Error('Review body must be at least 10 characters');
    err.status = 400;
    throw err;
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, isActive: true },
  });
  if (!product?.isActive) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }

  const orderId = await userHasVerifiedPurchase(userId, productId);
  if (!orderId) {
    const err = new Error('Verified purchase required to review this product');
    err.status = 403;
    throw err;
  }

  const existing = await prisma.productReview.findUnique({
    where: { productId_userId: { productId, userId } },
  });
  if (existing) {
    const err = new Error('You already reviewed this product');
    err.status = 409;
    throw err;
  }

  const review = await prisma.productReview.create({
    data: {
      productId,
      userId,
      orderId,
      rating,
      title: data.title ? String(data.title).slice(0, 120) : null,
      body: body.slice(0, 4000),
      isVerifiedPurchase: true,
    },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  await refreshProductRating(productId);
  return review;
}

async function voteReviewHelpful(userId, reviewId, helpful = true) {
  const review = await prisma.productReview.findUnique({ where: { id: reviewId } });
  if (!review) {
    const err = new Error('Review not found');
    err.status = 404;
    throw err;
  }

  const existing = await prisma.reviewVote.findUnique({
    where: { reviewId_userId: { reviewId, userId } },
  });

  if (existing) {
    if (existing.helpful === helpful) {
      return { reviewId, helpfulCount: review.helpfulCount };
    }
    await prisma.reviewVote.update({
      where: { id: existing.id },
      data: { helpful },
    });
    const delta = helpful ? 2 : -2;
    const updated = await prisma.productReview.update({
      where: { id: reviewId },
      data: { helpfulCount: { increment: delta } },
    });
    return { reviewId, helpfulCount: updated.helpfulCount };
  }

  await prisma.reviewVote.create({
    data: { reviewId, userId, helpful },
  });
  const updated = await prisma.productReview.update({
    where: { id: reviewId },
    data: { helpfulCount: { increment: helpful ? 1 : -1 } },
  });
  return { reviewId, helpfulCount: updated.helpfulCount };
}

async function getReviewEligibility(userId, productId) {
  const orderId = await userHasVerifiedPurchase(userId, productId);
  if (!orderId) return { canReview: false, reason: 'no_purchase' };
  const existing = await prisma.productReview.findUnique({
    where: { productId_userId: { productId, userId } },
  });
  if (existing) return { canReview: false, reason: 'already_reviewed', reviewId: existing.id };
  return { canReview: true, orderId };
}

module.exports = {
  listProductReviews,
  createProductReview,
  voteReviewHelpful,
  refreshProductRating,
  getReviewEligibility,
  userHasVerifiedPurchase,
};
