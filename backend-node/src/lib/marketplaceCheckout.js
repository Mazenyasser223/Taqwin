/**
 * Shared marketplace checkout validation and payment fulfillment.
 */
const { prisma } = require('../db');
const { emitNotification } = require('./notifications');
const { recordPurchaseFromOrder } = require('./commerce/recommendationEvents');
const { computeOrderTotals } = require('./shopShipping');
const { validateAiBundleDiscount } = require('./commerce/planProductRecommendations');
const { validateCoupon } = require('./commerce/shopCoupons');
const { completeReferralOnFirstPaidOrder } = require('./commerce/shopReferral');
const { recordFunnelEvent } = require('./commerce/shopFunnel');
const { earnFromPaidOrder } = require('./commerce/shopLoyalty');

async function validateOrderItems(items, opts = {}) {
  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
  });
  if (products.length !== productIds.length) {
    const err = new Error('One or more products are unavailable');
    err.status = 400;
    throw err;
  }

  const productMap = new Map(products.map((p) => [p.id, p]));
  let total = 0;
  const itemsData = items.map((i) => {
    const p = productMap.get(i.productId);
    if (p.stock != null && p.stock < i.quantity) {
      const err = new Error(`Insufficient stock for ${p.name}`);
      err.status = 400;
      throw err;
    }
    total += p.price * i.quantity;
    return { productId: p.id, quantity: i.quantity, unitPrice: p.price };
  });

  let subtotal = total;
  let discountAmount = 0;
  let discountPercent = 0;
  let appliedCoupon = null;
  let loyaltyPointsUsed = 0;
  let couponCode = null;

  if (opts.aiBundleProductIds?.length) {
    const validated = validateAiBundleDiscount(items, opts.aiBundleProductIds);
    if (validated) {
      discountPercent = validated.discountPercent;
      const aiDiscount = Math.round(subtotal * (discountPercent / 100) * 100) / 100;
      discountAmount += aiDiscount;
      subtotal = Math.round((subtotal - aiDiscount) * 100) / 100;
    }
  }

  if (opts.couponCode && opts.userId) {
    const { coupon, discountAmount: couponDiscount } = await validateCoupon(
      opts.couponCode,
      opts.userId,
      subtotal,
    );
    appliedCoupon = coupon;
    couponCode = coupon.code;
    discountAmount += couponDiscount;
    subtotal = Math.round((subtotal - couponDiscount) * 100) / 100;
  }

  if (opts.loyaltyPointsUsed && opts.userId) {
    const { getBalance, validateRedemption: validatePts } = require('./commerce/shopLoyalty');
    const balance = await getBalance(opts.userId);
    const redemption = validatePts(opts.loyaltyPointsUsed, balance, subtotal);
    loyaltyPointsUsed = redemption.pointsUsed;
    discountAmount += redemption.discountAmount;
    subtotal = Math.round((subtotal - redemption.discountAmount) * 100) / 100;
  }

  return {
    products,
    itemsData,
    subtotal,
    discountAmount,
    discountPercent,
    appliedCoupon,
    couponCode,
    loyaltyPointsUsed,
  };
}

async function decrementOrderStock(tx, items) {
  for (const item of items) {
    const updated = await tx.product.updateMany({
      where: {
        id: item.productId,
        isActive: true,
        OR: [{ stock: null }, { stock: { gte: item.quantity } }],
      },
      data: { stock: { decrement: item.quantity } },
    });
    if (updated.count === 0) {
      const err = new Error('Insufficient stock for one or more products');
      err.status = 409;
      throw err;
    }
  }
}

async function incrementOrderStock(tx, items) {
  for (const item of items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }
}

async function createPendingOrder(
  userId,
  itemsData,
  subtotal,
  currency = 'EGP',
  shipping = null,
  commerceMeta = null
) {
  const discountAmount = commerceMeta?.discountAmount ?? 0;
  const { shippingFee, total } = computeOrderTotals(subtotal);
  return prisma.order.create({
    data: {
      userId,
      subtotal,
      shippingFee,
      discountAmount,
      currency,
      total,
      status: 'pending_payment',
      paymentStatus: 'pending',
      commerceSource: commerceMeta?.commerceSource ?? null,
      commerceSessionId: commerceMeta?.commerceSessionId ?? null,
      commerceAbVariant: commerceMeta?.commerceAbVariant ?? null,
      commerceExperimentId: commerceMeta?.commerceExperimentId ?? null,
      couponCode: commerceMeta?.couponCode ?? null,
      loyaltyPointsUsed: commerceMeta?.loyaltyPointsUsed ?? 0,
      shippingGovernorate: shipping?.governorate ?? null,
      shippingCity: shipping?.city ?? null,
      shippingAddress: shipping?.address ?? null,
      shippingPhone: shipping?.phone ?? null,
      items: { createMany: { data: itemsData } },
    },
    include: { items: { include: { product: { include: { category: true } } } } },
  });
}

async function createInstantPaidOrder(userId, itemsData, subtotal, products) {
  const currency = products[0]?.currency || 'EGP';
  const { shippingFee, total } = computeOrderTotals(subtotal);
  const order = await prisma.$transaction(async (tx) => {
    await decrementOrderStock(tx, itemsData);
    return tx.order.create({
      data: {
        userId,
        subtotal,
        shippingFee,
        currency,
        total,
        status: 'confirmed',
        paymentStatus: 'paid',
        paidAt: new Date(),
        items: { createMany: { data: itemsData } },
      },
      include: { items: { include: { product: { include: { category: true } } } } },
    });
  });

  emitNotification({
    userId,
    type: 'order.placed',
    title: 'Order placed',
    message: `Your order for ${total.toFixed(0)} ${currency} is confirmed.`,
    link: '/orders',
  });

  return order;
}

async function fulfillPaidOrder(orderId, paymentReference, provider = 'paymob') {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true, user: { select: { id: true } } },
    });
    if (!order) return null;
    if (order.paymentStatus === 'paid') return order;

    await decrementOrderStock(tx, order.items);

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'paid',
        paymentProvider: provider,
        paymentReference: String(paymentReference),
        paidAt: new Date(),
        status: 'confirmed',
      },
      include: { items: { include: { product: { include: { category: true } } } } },
    });

    const currency = updated.items[0]?.product?.currency || 'EGP';
    emitNotification({
      userId: order.userId,
      type: 'order.paid',
      title: 'Payment received',
      message: `Your payment of ${order.total.toFixed(0)} ${currency} was successful. Order is confirmed.`,
      link: '/orders',
    });

    void recordPurchaseFromOrder(updated).catch(() => null);

    if (updated.couponCode) {
      const coupon = await tx.shopCoupon.findUnique({ where: { code: updated.couponCode } });
      if (coupon) {
        await tx.shopCouponRedemption.create({
          data: { couponId: coupon.id, userId: order.userId, orderId: order.id },
        });
        await tx.shopCoupon.update({
          where: { id: coupon.id },
          data: { usedCount: { increment: 1 } },
        });
      }
    }

    if (updated.loyaltyPointsUsed > 0) {
      await tx.loyaltyAccount.updateMany({
        where: { userId: order.userId, points: { gte: updated.loyaltyPointsUsed } },
        data: { points: { decrement: updated.loyaltyPointsUsed } },
      });
      await tx.loyaltyTransaction.create({
        data: {
          userId: order.userId,
          points: -updated.loyaltyPointsUsed,
          type: 'redeem_checkout',
          orderId: order.id,
          note: 'Redeemed at checkout',
        },
      });
    }

    return updated;
  }).then(async (updated) => {
    if (!updated) return null;
    void earnFromPaidOrder(updated.userId, updated.id, updated.total).catch(() => null);
    void completeReferralOnFirstPaidOrder(updated.userId, updated.id).catch(() => null);
    void recordFunnelEvent({
      userId: updated.userId,
      sessionId: updated.commerceSessionId || `order-${updated.id}`,
      step: 'paid',
      metadata: { orderId: updated.id, total: updated.total },
    }).catch(() => null);
    return updated;
  });
}

async function markOrderPaymentFailed(orderId, paymentReference, provider = 'paymob') {
  const result = await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: 'pending' },
    data: {
      paymentStatus: 'failed',
      paymentProvider: provider,
      paymentReference: paymentReference ? String(paymentReference) : undefined,
      status: 'cancelled',
    },
  });
  return result.count > 0;
}

module.exports = {
  validateOrderItems,
  decrementOrderStock,
  incrementOrderStock,
  createPendingOrder,
  createInstantPaidOrder,
  fulfillPaidOrder,
  markOrderPaymentFailed,
};
