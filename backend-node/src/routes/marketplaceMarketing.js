/**
 * Marketing — coupons preview, loyalty, referral.
 */
const express = require('express');
const { z } = require('zod');
const { validate } = require('../middleware/validate');
const { validateCoupon, listCoupons } = require('../lib/commerce/shopCoupons');
const { getBalance, getOrCreateAccount } = require('../lib/commerce/shopLoyalty');
const { getReferralSummary, getOrCreateReferralCode } = require('../lib/commerce/shopReferral');
const { prisma } = require('../db');

const router = express.Router();

const couponPreviewSchema = z.object({
  body: z.object({
    code: z.string().min(2).max(32),
    items: z.array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive().max(100),
      }),
    ).min(1),
  }),
});

router.get('/coupons/active', async (_req, res, next) => {
  try {
    const coupons = await listCoupons();
    res.json({
      items: coupons.filter((c) => c.isActive).map((c) => ({
        code: c.code,
        type: c.type,
        value: c.value,
        minOrderTotal: c.minOrderTotal,
        descriptionEn: c.descriptionEn,
        descriptionAr: c.descriptionAr,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/coupons/validate', validate(couponPreviewSchema), async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { id: { in: req.body.items.map((i) => i.productId) }, isActive: true },
    });
    const subtotal = req.body.items.reduce((sum, item) => {
      const p = products.find((x) => x.id === item.productId);
      return sum + (p ? p.price * item.quantity : 0);
    }, 0);
    const { coupon, discountAmount } = await validateCoupon(req.body.code, req.user.id, subtotal);
    res.json({
      valid: true,
      code: coupon.code,
      discountAmount,
      subtotalAfter: Math.round((subtotal - discountAmount) * 100) / 100,
      descriptionEn: coupon.descriptionEn,
      descriptionAr: coupon.descriptionAr,
    });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ valid: false, error: err.message });
    next(err);
  }
});

router.get('/loyalty/me', async (req, res, next) => {
  try {
    const account = await getOrCreateAccount(req.user.id);
    res.json({
      points: account.points,
      lifetimePoints: account.lifetimePoints,
      egpPerPoint: 1,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/referral/me', async (req, res, next) => {
  try {
    const summary = await getReferralSummary(req.user.id);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

router.post('/referral/ensure-code', async (req, res, next) => {
  try {
    const row = await getOrCreateReferralCode(req.user.id);
    res.json({ code: row.code });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
