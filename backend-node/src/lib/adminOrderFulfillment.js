const { prisma } = require('../db');
const { decrementOrderStock, incrementOrderStock } = require('./marketplaceCheckout');
const { emitNotification } = require('./notifications');

const PAID_STATUSES = new Set(['paid']);

function orderInclude() {
  return {
    user: { select: { id: true, email: true } },
    items: { include: { product: { include: { category: true } } } },
  };
}

async function applyAdminOrderUpdate(orderId, { status, paymentStatus, carrier, trackingNumber }) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true, user: { select: { id: true, email: true } } },
    });
    if (!existing) return null;

    const wasPaid = PAID_STATUSES.has(existing.paymentStatus);
    const data = {};

    if (status !== undefined) data.status = status;
    if (carrier !== undefined) data.carrier = carrier || null;
    if (trackingNumber !== undefined) data.trackingNumber = trackingNumber || null;
    if (paymentStatus !== undefined) {
      data.paymentStatus = paymentStatus;
      if (paymentStatus === 'paid' && !existing.paidAt) data.paidAt = new Date();
      if (paymentStatus !== 'paid') data.paidAt = null;
    }

    const nextStatus = status !== undefined ? status : existing.status;
    if (nextStatus === 'shipped' && !existing.shippedAt) {
      data.shippedAt = new Date();
    }
    if (nextStatus === 'delivered' && !existing.deliveredAt) {
      data.deliveredAt = new Date();
    }

    const nextPaid =
      paymentStatus !== undefined ? PAID_STATUSES.has(paymentStatus) : wasPaid;

    if (!wasPaid && nextPaid) {
      await decrementOrderStock(tx, existing.items);
    } else if (wasPaid && !nextPaid) {
      await incrementOrderStock(tx, existing.items);
    } else if (wasPaid && nextStatus === 'cancelled' && existing.status !== 'cancelled') {
      await incrementOrderStock(tx, existing.items);
      if (paymentStatus === undefined) {
        data.paymentStatus = 'refunded';
        data.paidAt = null;
      }
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data,
      include: orderInclude(),
    });

    return { previous: existing, updated };
  });
}

function notifyOrderChange(previous, updated) {
  if (!updated?.userId) return;

  if (updated.status !== previous.status) {
    if (updated.status === 'shipped') {
      emitNotification({
        userId: updated.userId,
        type: 'order.shipped',
        title: 'Order shipped',
        message: 'Your order is on the way.',
        link: `/orders/${updated.id}`,
      });
    } else if (updated.status === 'delivered') {
      emitNotification({
        userId: updated.userId,
        type: 'order.delivered',
        title: 'Order delivered',
        message: 'Your order has been delivered.',
        link: `/orders/${updated.id}`,
      });
    } else if (updated.status === 'cancelled') {
      emitNotification({
        userId: updated.userId,
        type: 'order.cancelled',
        title: 'Order cancelled',
        message: 'Your order was cancelled.',
        link: `/orders/${updated.id}`,
      });
    }
  }

  if (updated.paymentStatus !== previous.paymentStatus && updated.paymentStatus === 'paid') {
    emitNotification({
      userId: updated.userId,
      type: 'order.paid',
      title: 'Payment confirmed',
      message: `Payment of ${updated.total.toFixed(0)} EGP was confirmed.`,
      link: `/orders/${updated.id}`,
    });
  }
}

module.exports = { applyAdminOrderUpdate, notifyOrderChange, orderInclude };
