/**
 * CAG — active gym memberships and marketplace orders.
 */
const { prisma } = require('../../db');

/**
 * @param {string} userId
 */
async function buildGymTrainerOrdersSummary(userId) {
  const [memberships, recentOrders] = await Promise.all([
    prisma.gymMembership.findMany({
      where: { userId, isActive: true },
      include: { gym: { select: { id: true, name: true } } },
      orderBy: { joinedAt: 'desc' },
      take: 3,
    }),
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        status: true,
        total: true,
        createdAt: true,
        items: {
          take: 4,
          select: {
            quantity: true,
            product: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  return {
    activeGymMemberships: memberships.map((m) => ({
      gymId: m.gymId,
      gymName: m.gym?.name || null,
      joinedAt: m.joinedAt,
      expiresAt: m.expiresAt,
    })),
    recentOrders: recentOrders.map((o) => ({
      orderId: o.id,
      status: o.status,
      total: o.total,
      createdAt: o.createdAt,
      items: (o.items || []).map((i) => ({
        name: i.product?.name || 'Product',
        quantity: i.quantity,
      })),
    })),
    upcomingTrainerBookings: [],
  };
}

module.exports = { buildGymTrainerOrdersSummary };
