const { prisma } = require('../db');
const { getStripe, isStripeEnabled } = require('../services/stripeClient');
const { getFrontendUrl } = require('./frontendUrl');
const { emitNotification } = require('./notifications');
const { isAutoRefundEnabled, applyAutoRefund } = require('./paymentRefund');

const orderInclude = {
  items: { include: { product: { include: { category: true } } } },
  payments: { orderBy: { createdAt: 'desc' } },
};

function toMinorUnits(amount, currency) {
  const zeroDecimal = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf']);
  const code = (currency || 'EGP').toLowerCase();
  if (zeroDecimal.has(code)) return Math.round(amount);
  return Math.round(amount * 100);
}

async function createStripeCheckoutSession({ order, userEmail }) {
  const stripe = getStripe();
  if (!stripe) {
    throw Object.assign(new Error('Stripe is not configured'), { status: 503 });
  }

  const payment = order.payments?.[0];
  if (!payment || payment.provider !== 'stripe') {
    throw Object.assign(new Error('Order is not configured for Stripe'), { status: 400 });
  }
  if (order.status !== 'pending_payment') {
    throw Object.assign(new Error('Order is not awaiting payment'), { status: 400 });
  }

  const currency = (order.currency || 'EGP').toLowerCase();
  const frontend = getFrontendUrl();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: userEmail || undefined,
    line_items: [
      {
        price_data: {
          currency,
          unit_amount: toMinorUnits(order.total, currency),
          product_data: {
            name: `Taqwin Shop #${order.id.slice(0, 8).toUpperCase()}`,
            description: isAutoRefundEnabled()
              ? 'Demo store — payment is auto-refunded after checkout (test mode).'
              : 'Taqwin Shop order',
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      orderId: order.id,
      userId: order.userId,
      paymentId: payment.id,
    },
    success_url: `${frontend}/#/checkout/success?order=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontend}/#/checkout/pay/${order.id}?cancelled=1`,
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      externalId: session.id,
      metadata: {
        stripeSessionId: session.id,
        stripeMode: session.mode,
      },
    },
  });

  return { url: session.url, sessionId: session.id };
}

/**
 * Idempotent: mark Stripe checkout paid and optionally auto-refund.
 * @returns {{ order: object, autoRefunded: boolean } | null}
 */
async function fulfillStripeCheckoutSession(sessionId) {
  if (!isStripeEnabled()) return null;

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent'],
  });

  if (session.payment_status !== 'paid') return null;

  const orderId = session.metadata?.orderId;
  if (!orderId) return null;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  if (!order) return null;

  const payment = order.payments[0];
  if (!payment) return null;
  if (payment.status === 'refunded') {
    const existing = await prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
    return { order: existing, autoRefunded: true };
  }
  if (payment.status === 'paid') {
    const existing = await prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
    return { order: existing, autoRefunded: false };
  }
  if (payment.status !== 'pending') return null;

  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;

  const autoRefund = isAutoRefundEnabled();
  const shortId = orderId.slice(0, 8).toUpperCase();

  const updated = await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        externalId: paymentIntentId || session.id,
        metadata: {
          ...(payment.metadata && typeof payment.metadata === 'object' ? payment.metadata : {}),
          stripeSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
        },
      },
    });

    if (autoRefund) {
      let stripeRefundId = null;
      if (paymentIntentId) {
        const stripeRefund = await stripe.refunds.create({ payment_intent: paymentIntentId });
        stripeRefundId = stripeRefund.id;
      }
      return applyAutoRefund(tx, {
        order,
        payment: { ...payment, status: 'paid', externalId: paymentIntentId },
        items: order.items,
        restoreStock: false,
        gatewayRefunded: true,
        refundId: stripeRefundId,
      });
    }

    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    return tx.order.update({
      where: { id: orderId },
      data: { status: 'confirmed' },
      include: orderInclude,
    });
  });

  if (autoRefund) {
    emitNotification({
      userId: order.userId,
      type: 'order.refunded',
      link: '/orders',
      payload: { shortId, provider: 'stripe' },
    });
  } else {
    emitNotification({
      userId: order.userId,
      type: 'order.confirmed',
      link: '/orders',
      payload: { shortId },
    });
  }

  return { order: updated, autoRefunded: autoRefund };
}

async function syncStripeOrderForUser({ orderId, sessionId, userId }) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (order.userId !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });

  const stripe = getStripe();
  if (!stripe) throw Object.assign(new Error('Stripe is not configured'), { status: 503 });

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.metadata?.orderId !== orderId) {
    throw Object.assign(new Error('Session does not match order'), { status: 400 });
  }

  const result = await fulfillStripeCheckoutSession(sessionId);
  if (!result) {
    throw Object.assign(new Error('Payment not completed yet'), { status: 400 });
  }
  return result;
}

module.exports = {
  createStripeCheckoutSession,
  fulfillStripeCheckoutSession,
  syncStripeOrderForUser,
  toMinorUnits,
};
