/**
 * Loyalty points — earn on orders, redeem at checkout (1 point = 1 EGP).
 */
const { prisma } = require('../../db');

const POINTS_PER_EGP = Number(process.env.SHOP_LOYALTY_POINTS_PER_EGP) || 0.1; // 10 EGP = 1 point
const EGP_PER_POINT = Number(process.env.SHOP_LOYALTY_EGP_PER_POINT) || 1;
const MAX_REDEEM_PERCENT = Number(process.env.SHOP_LOYALTY_MAX_REDEEM_PERCENT) || 50;

async function getOrCreateAccount(userId) {
  let account = await prisma.loyaltyAccount.findUnique({ where: { userId } });
  if (!account) {
    account = await prisma.loyaltyAccount.create({ data: { userId, points: 0, lifetimePoints: 0 } });
  }
  return account;
}

async function getBalance(userId) {
  const account = await getOrCreateAccount(userId);
  return account.points;
}

function pointsForOrderTotal(totalEgp) {
  return Math.floor(Number(totalEgp) * POINTS_PER_EGP);
}

function validateRedemption(pointsToUse, availablePoints, orderSubtotalAfterOtherDiscounts) {
  const pts = Math.floor(Number(pointsToUse) || 0);
  if (pts <= 0) return { pointsUsed: 0, discountAmount: 0 };
  if (pts > availablePoints) {
    const err = new Error('Insufficient loyalty points');
    err.status = 400;
    throw err;
  }
  const maxDiscount = orderSubtotalAfterOtherDiscounts * (MAX_REDEEM_PERCENT / 100);
  const discountAmount = Math.min(pts * EGP_PER_POINT, maxDiscount, orderSubtotalAfterOtherDiscounts);
  const pointsUsed = Math.ceil(discountAmount / EGP_PER_POINT);
  return {
    pointsUsed,
    discountAmount: Math.round(discountAmount * 100) / 100,
  };
}

async function earnFromPaidOrder(userId, orderId, totalEgp) {
  const earned = pointsForOrderTotal(totalEgp);
  if (earned <= 0) return 0;

  await prisma.$transaction([
    prisma.loyaltyAccount.upsert({
      where: { userId },
      create: { userId, points: earned, lifetimePoints: earned },
      update: { points: { increment: earned }, lifetimePoints: { increment: earned } },
    }),
    prisma.loyaltyTransaction.create({
      data: {
        userId,
        points: earned,
        type: 'earn_order',
        orderId,
        note: `Earned from order ${orderId}`,
      },
    }),
  ]);
  return earned;
}

async function redeemPoints(userId, pointsUsed, orderId) {
  if (pointsUsed <= 0) return;
  await prisma.$transaction([
    prisma.loyaltyAccount.update({
      where: { userId },
      data: { points: { decrement: pointsUsed } },
    }),
    prisma.loyaltyTransaction.create({
      data: {
        userId,
        points: -pointsUsed,
        type: 'redeem_checkout',
        orderId,
        note: `Redeemed at checkout`,
      },
    }),
  ]);
}

module.exports = {
  getOrCreateAccount,
  getBalance,
  pointsForOrderTotal,
  validateRedemption,
  earnFromPaidOrder,
  redeemPoints,
  EGP_PER_POINT,
};
