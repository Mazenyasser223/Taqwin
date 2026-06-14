/**
 * Advance demo orders through shipped → delivered (dev / demo).
 * Usage: node scripts/simulate-order-lifecycle.js [--orderId=uuid]
 */
const { PrismaClient } = require('@prisma/client');
const { emitNotification } = require('../src/lib/notifications');

const prisma = new PrismaClient();

function trackingFor(orderId) {
  return `TQW-${orderId.slice(0, 8).toUpperCase()}`;
}

async function main() {
  const arg = process.argv.find((a) => a.startsWith('--orderId='));
  const orderId = arg?.split('=')[1];

  const where = orderId
    ? { id: orderId }
    : { status: { in: ['pending', 'confirmed', 'shipped'] } };

  const orders = await prisma.order.findMany({ where, orderBy: { createdAt: 'asc' }, take: 20 });
  if (orders.length === 0) {
    console.log('No orders to advance.');
    return;
  }

  for (const order of orders) {
    let next = null;
    if (order.status === 'pending' || order.status === 'confirmed') {
      next = 'shipped';
    } else if (order.status === 'shipped') {
      next = 'delivered';
    }
    if (!next) continue;

    const trackingNumber =
      next === 'shipped' && !order.trackingNumber ? trackingFor(order.id) : order.trackingNumber;

    await prisma.order.update({
      where: { id: order.id },
      data: { status: next, trackingNumber: trackingNumber ?? undefined },
    });

    emitNotification({
      userId: order.userId,
      type: next === 'shipped' ? 'order.shipped' : 'order.delivered',
      title: next === 'shipped' ? 'Order shipped' : 'Order delivered',
      message:
        next === 'shipped'
          ? `Your order is on the way. Tracking: ${trackingNumber}`
          : 'Your order has been delivered. Thanks for shopping with Taqwin!',
      link: '/orders',
    });

    console.log(`✓ ${order.id.slice(0, 8)} → ${next}${trackingNumber ? ` (${trackingNumber})` : ''}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
