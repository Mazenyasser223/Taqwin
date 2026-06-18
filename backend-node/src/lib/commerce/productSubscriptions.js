/**
 * Subscribe & save — recurring delivery every N days (default 30).
 */
const { prisma } = require('../../db');
const { normalizeProduct } = require('../shopProduct');
const { emitNotification } = require('../notifications');

const DEFAULT_INTERVAL_DAYS = Number(process.env.SHOP_SUBSCRIPTION_INTERVAL_DAYS) || 30;

const listProductSelect = {
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
};

async function listUserSubscriptions(userId) {
  const rows = await prisma.productSubscription.findMany({
    where: { userId, status: { not: 'cancelled' } },
    include: { product: { select: listProductSelect } },
    orderBy: { nextDeliveryAt: 'asc' },
  });
  return rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    quantity: r.quantity,
    intervalDays: r.intervalDays,
    status: r.status,
    nextDeliveryAt: r.nextDeliveryAt,
    lastOrderId: r.lastOrderId,
    pausedAt: r.pausedAt,
    cancelledAt: r.cancelledAt,
    createdAt: r.createdAt,
    product: normalizeProduct(r.product),
  }));
}

async function createSubscription(userId, data) {
  const productId = String(data.productId || '');
  const quantity = Math.max(1, Math.min(10, Math.floor(Number(data.quantity) || 1)));
  const intervalDays = Math.max(
    7,
    Math.min(90, Math.floor(Number(data.intervalDays) || DEFAULT_INTERVAL_DAYS)),
  );

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, isActive: true, stock: true, name: true },
  });
  if (!product?.isActive || (Number(product.stock) || 0) <= 0) {
    const err = new Error('Product unavailable for subscription');
    err.status = 400;
    throw err;
  }

  const existing = await prisma.productSubscription.findFirst({
    where: {
      userId,
      productId,
      status: { in: ['active', 'paused'] },
    },
  });
  if (existing) {
    const err = new Error('You already have an active subscription for this product');
    err.status = 409;
    throw err;
  }

  const nextDeliveryAt = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);

  const row = await prisma.productSubscription.create({
    data: {
      userId,
      productId,
      quantity,
      intervalDays,
      status: 'active',
      nextDeliveryAt,
    },
    include: { product: { select: listProductSelect } },
  });

  return {
    id: row.id,
    productId: row.productId,
    quantity: row.quantity,
    intervalDays: row.intervalDays,
    status: row.status,
    nextDeliveryAt: row.nextDeliveryAt,
    product: normalizeProduct(row.product),
  };
}

async function updateSubscription(userId, subscriptionId, patch) {
  const row = await prisma.productSubscription.findUnique({ where: { id: subscriptionId } });
  if (!row || row.userId !== userId) {
    const err = new Error('Subscription not found');
    err.status = 404;
    throw err;
  }
  if (row.status === 'cancelled') {
    const err = new Error('Subscription is cancelled');
    err.status = 400;
    throw err;
  }

  const data = {};
  if (patch.quantity != null) {
    data.quantity = Math.max(1, Math.min(10, Math.floor(Number(patch.quantity) || 1)));
  }
  if (patch.intervalDays != null) {
    data.intervalDays = Math.max(7, Math.min(90, Math.floor(Number(patch.intervalDays) || DEFAULT_INTERVAL_DAYS)));
  }
  if (patch.status === 'paused') {
    data.status = 'paused';
    data.pausedAt = new Date();
  }
  if (patch.status === 'active' && row.status === 'paused') {
    data.status = 'active';
    data.pausedAt = null;
    if (!row.nextDeliveryAt || row.nextDeliveryAt < new Date()) {
      data.nextDeliveryAt = new Date(Date.now() + (data.intervalDays || row.intervalDays) * 24 * 60 * 60 * 1000);
    }
  }

  const updated = await prisma.productSubscription.update({
    where: { id: subscriptionId },
    data,
    include: { product: { select: listProductSelect } },
  });

  return {
    id: updated.id,
    productId: updated.productId,
    quantity: updated.quantity,
    intervalDays: updated.intervalDays,
    status: updated.status,
    nextDeliveryAt: updated.nextDeliveryAt,
    product: normalizeProduct(updated.product),
  };
}

async function cancelSubscription(userId, subscriptionId) {
  const row = await prisma.productSubscription.findUnique({ where: { id: subscriptionId } });
  if (!row || row.userId !== userId) {
    const err = new Error('Subscription not found');
    err.status = 404;
    throw err;
  }
  if (row.status === 'cancelled') return { cancelled: true };

  await prisma.productSubscription.update({
    where: { id: subscriptionId },
    data: { status: 'cancelled', cancelledAt: new Date() },
  });
  return { cancelled: true };
}

/**
 * Cron — notify users when subscription delivery is due (checkout link, no auto-charge).
 * @param {{ dryRun?: boolean, limit?: number }} [opts]
 */
async function runSubscriptionDueBatch(opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const limit = Math.min(Math.max(Number(opts.limit) || 200, 1), 2000);
  const now = new Date();

  const due = await prisma.productSubscription.findMany({
    where: {
      status: 'active',
      nextDeliveryAt: { lte: now },
    },
    include: { product: { select: listProductSelect } },
    take: limit,
  });

  let notified = 0;
  for (const sub of due) {
    const product = sub.product;
    if (!product?.isActive || (Number(product.stock) || 0) <= 0) continue;

    if (!dryRun) {
      await emitNotification({
        userId: sub.userId,
        type: 'order.subscription_due',
        link: `/marketplace/product/${encodeURIComponent(product.slug || sub.productId)}?subscribe=1`,
        payload: { productName: product.name },
      });

      await prisma.productSubscription.update({
        where: { id: sub.id },
        data: {
          nextDeliveryAt: new Date(Date.now() + sub.intervalDays * 24 * 60 * 60 * 1000),
        },
      });
    }
    notified += 1;
  }

  return { ok: true, dryRun, notified, scanned: due.length };
}

module.exports = {
  listUserSubscriptions,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  runSubscriptionDueBatch,
  DEFAULT_INTERVAL_DAYS,
};
