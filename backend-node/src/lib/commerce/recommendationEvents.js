/**
 * Recommendation analytics — RecommendationEvent persistence + admin aggregates.
 */
const { randomUUID } = require('crypto');
const { prisma } = require('../../db');
const { logger } = require('../logger');
const { getRevenueBySource } = require('./revenueAttribution');
const { getActiveAbTestSummary } = require('./abTesting');
const { normalizeCommerceSource, ORDER_SOURCES } = require('./orderAttribution');
const { getMostWishlistedProducts } = require('./productWishlist');

const VALID_EVENTS = new Set([
  'shown',
  'clicked',
  'bundle_added',
  'purchased',
  'dismissed',
  'feedback_positive',
  'feedback_negative',
]);

function newCommerceSessionId() {
  return randomUUID();
}

/**
 * @param {object} data
 */
async function recordRecommendationEvent(data) {
  const eventType = String(data.eventType || '').toLowerCase();
  if (!VALID_EVENTS.has(eventType)) {
    const err = new Error(`Invalid eventType: ${eventType}`);
    err.status = 400;
    throw err;
  }

  const productIds = Array.isArray(data.productIds)
    ? data.productIds.filter(Boolean).map(String)
    : [];

  try {
    return await prisma.recommendationEvent.create({
      data: {
        userId: data.userId || null,
        eventType,
        source: String(data.source || 'unknown').slice(0, 64),
        bundleId: data.bundleId ? String(data.bundleId).slice(0, 128) : null,
        productId: data.productId || null,
        productIds,
        sessionId: data.sessionId ? String(data.sessionId).slice(0, 128) : null,
        orderId: data.orderId || null,
        metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : undefined,
      },
    });
  } catch (err) {
    logger.debug({ err, eventType }, 'RecommendationEvent insert failed');
    return null;
  }
}

/**
 * Link purchased events when an order is paid.
 * @param {object} order — with items[], userId, id, commerceSessionId
 */
async function recordPurchaseFromOrder(order) {
  if (!order?.id || !order.userId) return;
  const productIds = (order.items || []).map((i) => i.productId).filter(Boolean);
  if (!productIds.length) return;

  await recordRecommendationEvent({
    userId: order.userId,
    eventType: 'purchased',
    source: normalizeCommerceSource(order.commerceSource) || ORDER_SOURCES.DIRECT,
    productIds,
    sessionId: order.commerceSessionId || null,
    orderId: order.id,
    metadata: {
      total: order.total,
      discountAmount: order.discountAmount ?? 0,
      experimentId: order.commerceExperimentId ?? null,
      abVariant: order.commerceAbVariant ?? null,
    },
  });

  // Increment sales counts
  for (const pid of productIds) {
    await prisma.product.updateMany({
      where: { id: pid },
      data: { salesCount: { increment: 1 } },
    });
  }
}

/**
 * Admin analytics for AI commerce dashboard.
 * @param {{ days?: number }} [opts]
 */
async function getAiCommerceAnalytics(opts = {}) {
  const days = Math.min(Math.max(Number(opts.days) || 30, 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [events, revenueBySource, abTest, mostWishlisted] = await Promise.all([
    prisma.recommendationEvent.findMany({
      where: { createdAt: { gte: since } },
      select: {
        eventType: true,
        productId: true,
        productIds: true,
        orderId: true,
        metadata: true,
        createdAt: true,
      },
    }),
    getRevenueBySource({ days }),
    getActiveAbTestSummary({ days }),
    getMostWishlistedProducts({ limit: 10 }),
  ]);

  const counts = {
    shown: 0,
    clicked: 0,
    bundle_added: 0,
    purchased: 0,
    dismissed: 0,
    feedback_positive: 0,
    feedback_negative: 0,
  };
  const productHits = new Map();
  let aiRevenue = 0;

  for (const e of events) {
    counts[e.eventType] = (counts[e.eventType] || 0) + 1;
    const ids = e.productId ? [e.productId, ...e.productIds] : e.productIds;
    for (const pid of ids) {
      if (!pid) continue;
      productHits.set(pid, (productHits.get(pid) || 0) + 1);
    }
    if (e.eventType === 'purchased' && e.metadata && typeof e.metadata === 'object') {
      const total = Number(e.metadata.total);
      if (Number.isFinite(total)) aiRevenue += total;
    }
  }

  const purchasedOrders = await prisma.order.findMany({
    where: {
      paymentStatus: 'paid',
      paidAt: { gte: since },
      commerceSource: { in: [ORDER_SOURCES.AI_BUNDLE, ORDER_SOURCES.AI_RECOMMENDATION] },
    },
    select: { total: true, discountAmount: true },
  });
  const orderRevenue = purchasedOrders.reduce((s, o) => s + Number(o.total || 0), 0);
  if (orderRevenue > aiRevenue) aiRevenue = orderRevenue;

  const topProductIds = [...productHits.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);

  const topProducts = topProductIds.length
    ? await prisma.product.findMany({
        where: { id: { in: topProductIds } },
        select: { id: true, name: true, nameAr: true, price: true, imageUrl: true, salesCount: true },
      })
    : [];

  const topProductsRanked = topProductIds
    .map((id) => {
      const p = topProducts.find((x) => x.id === id);
      return p ? { ...p, eventCount: productHits.get(id) || 0 } : null;
    })
    .filter(Boolean);

  const shown = counts.shown || 0;
  const bundleAdded = counts.bundle_added || 0;
  const purchased = counts.purchased || 0;

  return {
    periodDays: days,
    since: since.toISOString(),
    counts,
    recommendationsShown: shown,
    bundlesAdded: bundleAdded,
    aiOrders: purchased,
    aiRevenue: Math.round(aiRevenue * 100) / 100,
    conversionRate: shown > 0 ? Math.round((purchased / shown) * 10000) / 100 : 0,
    bundleConversionRate: bundleAdded > 0 ? Math.round((purchased / bundleAdded) * 10000) / 100 : 0,
    topProducts: topProductsRanked,
    revenueBySource,
    abTest,
    mostWishlisted,
    feedbackPositive: counts.feedback_positive || 0,
    feedbackNegative: counts.feedback_negative || 0,
  };
}

module.exports = {
  recordRecommendationEvent,
  recordPurchaseFromOrder,
  getAiCommerceAnalytics,
  newCommerceSessionId,
  VALID_EVENTS,
};
