/**
 * Shop coupons — validate + apply at checkout.
 */
const { prisma } = require('../../db');
const { isMissingShopTableError } = require('./prismaShopTables');

const DEFAULT_COUPONS = [
  {
    id: 'seed-welcome10',
    code: 'WELCOME10',
    type: 'percent',
    value: 10,
    minOrderTotal: 200,
    maxUses: 10000,
    usedCount: 0,
    perUserLimit: 1,
    isActive: true,
    descriptionEn: '10% off your first order',
    descriptionAr: 'خصم 10% على أول طلب',
  },
  {
    id: 'seed-ramadan20',
    code: 'RAMADAN20',
    type: 'percent',
    value: 20,
    minOrderTotal: 500,
    maxUses: 5000,
    usedCount: 0,
    perUserLimit: 3,
    isActive: true,
    descriptionEn: '20% Ramadan offer',
    descriptionAr: 'عرض رمضان 20%',
  },
  {
    id: 'seed-coach15',
    code: 'COACH15',
    type: 'percent',
    value: 15,
    minOrderTotal: 300,
    maxUses: null,
    usedCount: 0,
    perUserLimit: 5,
    isActive: true,
    descriptionEn: '15% off for coached athletes',
    descriptionAr: 'خصم 15% للرياضيين',
  },
];

function normalizeCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

async function getCouponByCode(code) {
  return prisma.shopCoupon.findUnique({ where: { code: normalizeCode(code) } });
}

async function validateCoupon(code, userId, itemsSubtotal) {
  const coupon = await getCouponByCode(code);
  if (!coupon || !coupon.isActive) {
    const err = new Error('Invalid or inactive coupon code');
    err.status = 400;
    throw err;
  }

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    const err = new Error('Coupon is not active yet');
    err.status = 400;
    throw err;
  }
  if (coupon.expiresAt && coupon.expiresAt < now) {
    const err = new Error('Coupon has expired');
    err.status = 400;
    throw err;
  }
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    const err = new Error('Coupon usage limit reached');
    err.status = 400;
    throw err;
  }
  if (itemsSubtotal < coupon.minOrderTotal) {
    const err = new Error(`Minimum order ${coupon.minOrderTotal} EGP required for this coupon`);
    err.status = 400;
    throw err;
  }

  const userUses = await prisma.shopCouponRedemption.count({
    where: { couponId: coupon.id, userId },
  });
  if (userUses >= coupon.perUserLimit) {
    const err = new Error('You have already used this coupon');
    err.status = 400;
    throw err;
  }

  let discountAmount = 0;
  if (coupon.type === 'percent') {
    discountAmount = Math.round(itemsSubtotal * (coupon.value / 100) * 100) / 100;
  } else {
    discountAmount = Math.min(itemsSubtotal, coupon.value);
  }

  return { coupon, discountAmount };
}

async function redeemCoupon(couponId, userId, orderId) {
  await prisma.$transaction([
    prisma.shopCouponRedemption.create({
      data: { couponId, userId, orderId },
    }),
    prisma.shopCoupon.update({
      where: { id: couponId },
      data: { usedCount: { increment: 1 } },
    }),
  ]);
}

async function listCoupons() {
  try {
    return await prisma.shopCoupon.findMany({ orderBy: { code: 'asc' } });
  } catch (err) {
    if (isMissingShopTableError(err)) return DEFAULT_COUPONS;
    throw err;
  }
}

module.exports = { normalizeCode, getCouponByCode, validateCoupon, redeemCoupon, listCoupons };
