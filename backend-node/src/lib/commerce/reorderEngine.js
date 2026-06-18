/**
 * Reorder engine — suggest products ~30 days after last paid purchase.
 */
const { prisma } = require('../../db');
const { normalizeProduct } = require('../shopProduct');
const { emitNotification } = require('../notifications');

const DEFAULT_REORDER_DAYS = Number(process.env.SHOP_REORDER_DAYS) || 30;
const REMINDER_COOLDOWN_DAYS = Number(process.env.SHOP_REORDER_REMINDER_COOLDOWN_DAYS) || 7;

function daysBetween(a, b) {
  return Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Last paid purchase per product for a user.
 * @param {string} userId
 * @param {{ minDays?: number }} [opts]
 */
async function getReorderSuggestions(userId, opts = {}) {
  const minDays = Number(opts.minDays) || DEFAULT_REORDER_DAYS;

  const paidItems = await prisma.orderItem.findMany({
    where: {
      order: {
        userId,
        paymentStatus: 'paid',
        paidAt: { not: null },
      },
    },
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          nameAr: true,
          brand: true,
          price: true,
          currency: true,
          imageUrl: true,
          stock: true,
          isActive: true,
          avgRating: true,
          reviewCount: true,
        },
      },
      order: { select: { paidAt: true, id: true } },
    },
    orderBy: { order: { paidAt: 'desc' } },
  });

  const latestByProduct = new Map();
  for (const item of paidItems) {
    if (!item.product?.isActive || (Number(item.product.stock) || 0) <= 0) continue;
    if (latestByProduct.has(item.productId)) continue;
    latestByProduct.set(item.productId, item);
  }

  const now = new Date();
  const suggestions = [];

  for (const item of latestByProduct.values()) {
    const paidAt = item.order.paidAt;
    if (!paidAt) continue;
    const daysSince = daysBetween(paidAt, now);
    if (daysSince < minDays) continue;

    const newerPurchase = await prisma.orderItem.findFirst({
      where: {
        productId: item.productId,
        order: {
          userId,
          paymentStatus: 'paid',
          paidAt: { gt: paidAt },
        },
      },
      select: { id: true },
    });
    if (newerPurchase) continue;

    suggestions.push({
      productId: item.productId,
      product: normalizeProduct(item.product),
      lastOrderId: item.order.id,
      lastPurchasedAt: paidAt.toISOString(),
      daysSincePurchase: daysSince,
      suggestedQuantity: Math.max(1, item.quantity || 1),
    });
  }

  suggestions.sort((a, b) => b.daysSincePurchase - a.daysSincePurchase);
  return suggestions;
}

/**
 * Cron — notify users with due reorder suggestions (deduped by recent notification).
 * @param {{ dryRun?: boolean, limit?: number }} [opts]
 */
async function runReorderReminderBatch(opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const limit = Math.min(Math.max(Number(opts.limit) || 200, 1), 2000);
  const cooldownSince = new Date(Date.now() - REMINDER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

  const usersWithPaidOrders = await prisma.order.findMany({
    where: {
      paymentStatus: 'paid',
      paidAt: {
        lte: new Date(Date.now() - DEFAULT_REORDER_DAYS * 24 * 60 * 60 * 1000),
      },
    },
    select: { userId: true },
    distinct: ['userId'],
    take: limit,
  });

  let notified = 0;
  let skipped = 0;

  for (const { userId } of usersWithPaidOrders) {
    const suggestions = await getReorderSuggestions(userId);
    if (!suggestions.length) {
      skipped += 1;
      continue;
    }

    const top = suggestions[0];
    const recent = await prisma.notification.findFirst({
      where: {
        userId,
        type: 'order.reorder_reminder',
        createdAt: { gte: cooldownSince },
      },
      select: { id: true },
    });
    if (recent) {
      skipped += 1;
      continue;
    }

    const productName = top.product?.name || 'product';
    if (!dryRun) {
      await emitNotification({
        userId,
        type: 'order.reorder_reminder',
        link: `/marketplace/product/${encodeURIComponent(top.product?.slug || top.productId)}`,
        payload: { productName },
      });
    }
    notified += 1;
  }

  return { ok: true, dryRun, notified, skipped, scanned: usersWithPaidOrders.length };
}

module.exports = {
  getReorderSuggestions,
  runReorderReminderBatch,
  DEFAULT_REORDER_DAYS,
};
