/**
 * Marketplace optimization — reviews, wishlist, reorder, subscriptions.
 */
const express = require('express');
const { z } = require('zod');
const { validate } = require('../middleware/validate');
const {
  listProductReviews,
  createProductReview,
  voteReviewHelpful,
  getReviewEligibility,
} = require('../lib/commerce/productReviews');
const {
  listUserWishlist,
  addToWishlist,
  removeFromWishlist,
  isProductWishlisted,
} = require('../lib/commerce/productWishlist');
const { getReorderSuggestions } = require('../lib/commerce/reorderEngine');
const {
  listUserSubscriptions,
  createSubscription,
  updateSubscription,
  cancelSubscription,
} = require('../lib/commerce/productSubscriptions');

const router = express.Router();

const idParam = z.object({ params: z.object({ id: z.string().uuid() }) });
const productIdParam = z.object({ params: z.object({ productId: z.string().uuid() }) });

const reviewListSchema = z.object({
  params: z.object({ productId: z.string().uuid() }),
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }),
});

const reviewCreateSchema = z.object({
  params: z.object({ productId: z.string().uuid() }),
  body: z.object({
    rating: z.coerce.number().int().min(1).max(5),
    title: z.string().max(120).optional(),
    body: z.string().min(10).max(4000),
  }),
});

const voteSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ helpful: z.boolean().optional().default(true) }),
});

const subscriptionCreateSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    quantity: z.coerce.number().int().min(1).max(10).optional(),
    intervalDays: z.coerce.number().int().min(7).max(90).optional(),
  }),
});

const subscriptionPatchSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    quantity: z.coerce.number().int().min(1).max(10).optional(),
    intervalDays: z.coerce.number().int().min(7).max(90).optional(),
    status: z.enum(['active', 'paused']).optional(),
  }),
});

router.get('/products/:productId/reviews', validate(reviewListSchema), async (req, res, next) => {
  try {
    const result = await listProductReviews(req.params.productId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/products/:productId/reviews/eligibility', validate(productIdParam), async (req, res, next) => {
  try {
    const eligibility = await getReviewEligibility(req.user.id, req.params.productId);
    res.json(eligibility);
  } catch (err) {
    next(err);
  }
});

router.post('/products/:productId/reviews', validate(reviewCreateSchema), async (req, res, next) => {
  try {
    const review = await createProductReview(req.user.id, req.params.productId, req.body);
    res.status(201).json(review);
  } catch (err) {
    next(err);
  }
});

router.post('/reviews/:id/vote', validate(voteSchema), async (req, res, next) => {
  try {
    const result = await voteReviewHelpful(req.user.id, req.params.id, req.body.helpful !== false);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/wishlist', async (req, res, next) => {
  try {
    const items = await listUserWishlist(req.user.id);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.get('/wishlist/check/:productId', validate(productIdParam), async (req, res, next) => {
  try {
    const saved = await isProductWishlisted(req.user.id, req.params.productId);
    res.json({ saved });
  } catch (err) {
    next(err);
  }
});

router.post('/wishlist/:productId', validate(productIdParam), async (req, res, next) => {
  try {
    const result = await addToWishlist(req.user.id, req.params.productId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.delete('/wishlist/:productId', validate(productIdParam), async (req, res, next) => {
  try {
    const result = await removeFromWishlist(req.user.id, req.params.productId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/reorder/suggestions', async (req, res, next) => {
  try {
    const minDays = req.query.minDays ? Number(req.query.minDays) : undefined;
    const suggestions = await getReorderSuggestions(req.user.id, { minDays });
    res.json({ suggestions });
  } catch (err) {
    next(err);
  }
});

router.get('/subscriptions', async (req, res, next) => {
  try {
    const items = await listUserSubscriptions(req.user.id);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.post('/subscriptions', validate(subscriptionCreateSchema), async (req, res, next) => {
  try {
    const sub = await createSubscription(req.user.id, req.body);
    res.status(201).json(sub);
  } catch (err) {
    next(err);
  }
});

router.patch('/subscriptions/:id', validate(subscriptionPatchSchema), async (req, res, next) => {
  try {
    const sub = await updateSubscription(req.user.id, req.params.id, req.body);
    res.json(sub);
  } catch (err) {
    next(err);
  }
});

router.delete('/subscriptions/:id', validate(idParam), async (req, res, next) => {
  try {
    const result = await cancelSubscription(req.user.id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
