const { prisma } = require('../db');
const { computeCheckoutTotals } = require('./checkoutTotals');
const { emitNotification } = require('./notifications');
const { isAutoRefundEnabled, applyAutoRefund } = require('./paymentRefund');
const { isStripeEnabled } = require('../services/stripeClient');

const ONLINE_METHODS = new Set(['card', 'fawry', 'wallet']);

function resolveOnlinePaymentProvider(paymentMethod) {
  if (paymentMethod === 'card' && isStripeEnabled()) return 'stripe';
  return 'mock';
}

async function loadProductsForItems(items) {
  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
  });
  if (products.length !== productIds.length) {
    throw Object.assign(new Error('One or more products are unavailable'), { status: 400 });
  }
  return new Map(products.map((p) => [p.id, p]));
}

async function decrementStock(tx, items) {
  for (const item of items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { decrement: item.quantity } },
    });
  }
}

const orderInclude = {
  items: { include: { product: { include: { category: true } } } },
  payments: { orderBy: { createdAt: 'desc' } },
};

async function createCheckoutOrder({ userId, items, shipping, paymentMethod }) {
  const productMap = await loadProductsForItems(items);
  const totals = computeCheckoutTotals(items, productMap, shipping.governorate);

  const isCod = paymentMethod === 'cod';
  const initialStatus = isCod ? 'pending' : 'pending_payment';
  const paymentProvider = isCod ? 'cod' : resolveOnlinePaymentProvider(paymentMethod);

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId,
        status: initialStatus,
        subtotal: totals.subtotal,
        shippingFee: totals.shippingFee,
        total: totals.total,
        currency: totals.currency,
        paymentMethod,
        shippingGovernorate: shipping.governorate,
        shippingCity: shipping.city,
        shippingAddress: shipping.address,
        shippingPhone: shipping.phone,
        items: { createMany: { data: totals.itemsData } },
        payments: {
          create: {
            provider: paymentProvider,
            amount: totals.total,
            currency: totals.currency,
            status: 'pending',
          },
        },
      },
      include: orderInclude,
    });

    if (isCod) {
      await decrementStock(tx, totals.itemsData);
    }

    return created;
  });

  if (isCod) {
    emitNotification({
      userId,
      type: 'order.placed',
      link: '/orders',
      payload: {
        variant: 'cod',
        total: totals.total.toFixed(0),
        currency: totals.currency,
        phone: shipping.phone,
      },
    });
  } else {
    emitNotification({
      userId,
      type: 'order.placed',
      link: `/checkout/pay/${order.id}`,
      payload: {
        variant: 'payment',
        total: totals.total.toFixed(0),
        currency: totals.currency,
      },
    });
  }

  return {
    order,
    needsPayment: ONLINE_METHODS.has(paymentMethod),
  };
}

async function confirmMockPayment({ orderId, userId }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (order.userId !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });
  if (order.status !== 'pending_payment') {
    throw Object.assign(new Error('Order is not awaiting payment'), { status: 400 });
  }

  const payment = order.payments[0];
  if (!payment || payment.status === 'paid' || payment.status === 'refunded') {
    throw Object.assign(new Error('No pending payment found'), { status: 400 });
  }
  if (payment.provider === 'stripe') {
    throw Object.assign(new Error('Complete payment via Stripe Checkout'), { status: 400 });
  }

  const autoRefund = isAutoRefundEnabled();

  let updated = await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'paid', paidAt: new Date() },
    });

    if (autoRefund) {
      const paidPayment = { ...payment, status: 'paid' };
      return applyAutoRefund(tx, {
        order,
        payment: paidPayment,
        items: order.items,
        restoreStock: false,
      });
    }

    await decrementStock(tx, order.items);

    return tx.order.update({
      where: { id: orderId },
      data: { status: 'confirmed' },
      include: orderInclude,
    });
  });

  const shortId = orderId.slice(0, 8).toUpperCase();

  if (autoRefund) {
    emitNotification({
      userId,
      type: 'order.refunded',
      link: '/orders',
      payload: { shortId, provider: 'demo' },
    });
  } else {
    emitNotification({
      userId,
      type: 'order.confirmed',
      link: '/orders',
      payload: { shortId },
    });
  }

  return { order: updated, autoRefunded: autoRefund };
}

module.exports = { createCheckoutOrder, confirmMockPayment, loadProductsForItems };
