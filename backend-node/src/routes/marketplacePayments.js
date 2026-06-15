/**
 * Marketplace Paymob payments
 *
 *   POST /api/marketplace/payments/create   (auth) — pending order + checkout URL
 *   POST /api/marketplace/payments/webhook  (public, HMAC) — confirm payment + stock
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { emitNotification } = require('../lib/notifications');
const { logger } = require('../lib/logger');
const { normalizeCommerceSource, resolveCheckoutSource, ORDER_SOURCES } = require('../lib/commerce/orderAttribution');
const {
  validateOrderItems,
  createPendingOrder,
  fulfillPaidOrder,
  markOrderPaymentFailed,
} = require('../lib/marketplaceCheckout');
const { assertCheckoutTotals } = require('../lib/checkoutTotals');
const { recordFunnelEvent } = require('../lib/commerce/shopFunnel');
const { captureException, capturePaymentFailure, captureCronFailure } = require('../lib/sentry');
const { paymentsCreateLimiter } = require('../middleware/rateLimitApi');
const {
  isPaymobConfigured,
  createCheckoutSession,
  verifyTransactionHmac,
  extractOrderIdFromTransaction,
} = require('../services/paymobService');

const router = express.Router();

const paymentCreateSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          productId: z.string().uuid(),
          quantity: z.number().int().positive().max(100),
        })
      )
      .min(1),
    shipping: z.object({
      governorate: z.string().trim().min(2).max(100),
      city: z.string().trim().min(2).max(100),
      address: z.string().trim().min(5).max(500),
      phone: z.string().trim().min(10).max(20),
    }),
    aiBundle: z
      .object({
        productIds: z.array(z.string().uuid()).min(2),
        sessionId: z.string().max(128).optional(),
        abVariant: z.string().max(8).optional(),
        experimentId: z.string().uuid().optional(),
      })
      .optional(),
    couponCode: z.string().trim().min(2).max(32).optional(),
    loyaltyPointsUsed: z.coerce.number().int().min(0).max(100000).optional(),
    funnelSessionId: z.string().max(128).optional(),
    commerceSource: z
      .enum([
        'ai_bundle',
        'ai_recommendation',
        'search',
        'category',
        'featured',
        'direct',
      ])
      .optional(),
  }),
});

function getBackendPublicUrl() {
  return (
    process.env.BACKEND_PUBLIC_URL?.trim() ||
    process.env.PAYMOB_NOTIFICATION_BASE_URL?.trim() ||
    `http://127.0.0.1:${process.env.PORT || 4000}`
  ).replace(/\/$/, '');
}

function getFrontendBaseUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
}

/** Public — Paymob transaction processed callback */
router.post('/webhook', async (req, res) => {
  if (!isPaymobConfigured()) {
    return res.status(503).json({ error: 'Paymob is not configured' });
  }

  const receivedHmac = req.query.hmac;
  const payload = req.body;
  const transaction = payload?.obj;

  if (!transaction || payload?.type !== 'TRANSACTION') {
    return res.status(400).json({ error: 'Invalid Paymob callback payload' });
  }

  if (!verifyTransactionHmac(transaction, receivedHmac)) {
    logger.warn({ paymobOrderId: transaction.order?.id }, 'Paymob webhook HMAC verification failed');
    return res.status(401).json({ error: 'Invalid HMAC signature' });
  }

  const orderId = extractOrderIdFromTransaction(transaction);
  if (!orderId) {
    logger.warn({ paymobOrderId: transaction.order?.id }, 'Paymob webhook missing merchant order reference');
    return res.status(400).json({ error: 'Missing order reference' });
  }

  const paymentReference = String(transaction.id ?? transaction.order?.id ?? '');

  try {
    if (transaction.success && !transaction.pending) {
      await fulfillPaidOrder(orderId, paymentReference, 'paymob');
      logger.info({ orderId, transactionId: transaction.id }, 'Paymob payment fulfilled');
    } else if (!transaction.pending) {
      await markOrderPaymentFailed(orderId, paymentReference, 'paymob');
      capturePaymentFailure(orderId, paymentReference, 'paymob_webhook');
      logger.info({ orderId, transactionId: transaction.id }, 'Paymob payment failed');
    }
  } catch (err) {
    logger.error({ err, orderId }, 'Paymob webhook fulfillment error');
    captureException(err, { orderId, source: 'paymob_webhook' });
    return res.status(500).json({ error: 'Failed to update order' });
  }

  return res.json({ received: true });
});

router.use(authMiddleware);

/** Authenticated — create pending order and Paymob checkout session */
router.post('/create', paymentsCreateLimiter, validate(paymentCreateSchema), async (req, res, next) => {
  try {
    if (!isPaymobConfigured()) {
      return res.status(503).json({
        error:
          'Paymob is not configured. Set PAYMOB_API_KEY, PAYMOB_INTEGRATION_ID, PAYMOB_IFRAME_ID, and PAYMOB_HMAC_SECRET.',
      });
    }

    const { products, itemsData, subtotal, discountAmount, couponCode, loyaltyPointsUsed } =
      await validateOrderItems(req.body.items, {
        aiBundleProductIds: req.body.aiBundle?.productIds,
        userId: req.user.id,
        couponCode: req.body.couponCode,
        loyaltyPointsUsed: req.body.loyaltyPointsUsed,
      });
    const currency = products[0]?.currency || 'EGP';
    const bundleSource = req.body.aiBundle ? ORDER_SOURCES.AI_BUNDLE : null;
    const resolvedSource = resolveCheckoutSource(
      bundleSource || req.body.commerceSource,
      req.body.commerceSource
    );

    const sessionId = req.body.funnelSessionId || req.body.aiBundle?.sessionId || null;

    const order = await createPendingOrder(
      req.user.id,
      itemsData,
      subtotal,
      currency,
      req.body.shipping,
      {
        discountAmount,
        commerceSource: resolvedSource,
        commerceSessionId: sessionId,
        commerceAbVariant: req.body.aiBundle?.abVariant ?? null,
        commerceExperimentId: req.body.aiBundle?.experimentId ?? null,
        couponCode,
        loyaltyPointsUsed,
      }
    );
    const totals = assertCheckoutTotals(order, itemsData);

    if (sessionId) {
      void recordFunnelEvent({
        userId: req.user.id,
        sessionId,
        step: 'checkout_start',
        metadata: { orderId: order.id, total: order.total },
      }).catch(() => null);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        phone: true,
        athleteProfile: { select: { displayName: true } },
        gymProfile: { select: { displayName: true } },
      },
    });
    const profile = user?.athleteProfile || user?.gymProfile;

    const notificationUrl = `${getBackendPublicUrl()}/api/marketplace/payments/webhook`;
    const redirectionUrl = `${getFrontendBaseUrl()}/#/payment/success?orderId=${order.id}`;

    const session = await createCheckoutSession({
      order,
      user,
      profile,
      products,
      itemsData,
      notificationUrl,
      redirectionUrl,
    });

    if (!session.checkoutUrl) {
      return res.status(502).json({ error: 'Paymob checkout session could not be created' });
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentProvider: 'paymob',
        paymentReference: session.paymentReference,
      },
    });

    emitNotification({
      userId: req.user.id,
      type: 'order.awaiting_payment',
      title: 'Complete your payment',
      message: `Your order for ${order.total.toFixed(0)} ${currency} is awaiting payment.`,
      link: '/orders',
    });

    res.status(201).json({
      orderId: order.id,
      checkoutUrl: session.checkoutUrl,
      paymentReference: session.paymentReference,
      paymobOrderId: session.paymobOrderId,
      subtotal: totals.subtotal,
      shippingFee: totals.shippingFee,
      total: totals.total,
      currency: order.currency,
      paymobAmountCents: session.paymobAmountCents ?? totals.paymobAmountCents,
    });
  } catch (err) {
    if (err.status === 400 || err.status === 409 || err.status === 502) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
