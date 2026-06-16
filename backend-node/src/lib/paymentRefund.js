/** Demo auto-refund after online payment (Solution A). */

const { getStripe } = require('../services/stripeClient');
function isAutoRefundEnabled() {
  if (process.env.NODE_ENV === 'production') {
    return process.env.CHECKOUT_AUTO_REFUND === 'true';
  }
  return process.env.CHECKOUT_AUTO_REFUND !== 'false';
}

/**
 * @param {{ id: string, provider: string, externalId?: string | null, metadata?: object | null }} payment
 */
async function refundPayment(payment) {
  if (payment.provider === 'mock') {
    return { refundId: `mock_ref_${payment.id}`, instant: true };
  }
  if (payment.provider === 'stripe' && payment.externalId) {
    const stripe = getStripe();
    if (!stripe) throw new Error('Stripe is not configured');
    await stripe.refunds.create({ payment_intent: payment.externalId });
    return { refundId: `stripe_ref_${payment.externalId}`, instant: false };
  }
  if (payment.provider === 'paymob' && payment.externalId) {
    throw new Error('Paymob refund not configured yet');
  }
  throw new Error(`Refund not supported for provider: ${payment.provider}`);
}

/**
 * Mark payment refunded, cancel order, optionally restore stock.
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 */
async function applyAutoRefund(
  tx,
  { order, payment, items, restoreStock = true, gatewayRefunded = false, refundId = null }
) {
  const existingMeta =
    payment.metadata && typeof payment.metadata === 'object' && !Array.isArray(payment.metadata)
      ? payment.metadata
      : {};

  const result = gatewayRefunded
    ? { refundId: refundId || 'gateway_refund' }
    : await refundPayment(payment);

  await tx.payment.update({
    where: { id: payment.id },
    data: {
      status: 'refunded',
      metadata: {
        ...existingMeta,
        refundId: result.refundId,
        refundedAt: new Date().toISOString(),
        autoRefund: true,
      },
    },
  });

  if (restoreStock) {
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }
  }

  return tx.order.update({
    where: { id: order.id },
    data: { status: 'cancelled' },
    include: {
      items: { include: { product: { include: { category: true } } } },
      payments: { orderBy: { createdAt: 'desc' } },
    },
  });
}

module.exports = { isAutoRefundEnabled, refundPayment, applyAutoRefund };
