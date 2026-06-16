/**
 * AI commerce — recommendations, events, diet-plan products.
 *
 *   GET  /api/ai/commerce/recommendations?locale=en|ar
 *   GET  /api/ai/commerce/diet-products?locale=en|ar&dayIndex=
 *   POST /api/ai/commerce/events
 */
const express = require('express');
const { z } = require('zod');
const { validate } = require('../../middleware/validate');
const {
  getPlanProductRecommendations,
  buildEmptyRecommendationBundle,
} = require('../../lib/commerce/planProductRecommendations');
const { getDietPlanShopProducts } = require('../../lib/commerce/dietPlanProducts');
const {
  recordRecommendationEvent,
  VALID_EVENTS,
} = require('../../lib/commerce/recommendationEvents');
const {
  getCachedRecommendations,
  setCachedRecommendations,
} = require('../../lib/commerce/aiRecommendationsCache');
const { getCommerceSettings } = require('../../lib/commerce/commerceSettings');

const router = express.Router();

const DB_BUSY_CODES = new Set(['P2024', 'P1001', 'P1002', 'P1008']);

function isDbBusyError(err) {
  return Boolean(err && DB_BUSY_CODES.has(err.code));
}

function emptyDietProducts(locale) {
  return {
    locale,
    mealNames: [],
    products: [],
    subtotal: 0,
    currency: 'EGP',
    empty: true,
  };
}

const listSchema = z.object({
  query: z.object({
    locale: z.enum(['en', 'ar']).optional(),
    sessionId: z.string().uuid().optional(),
    refresh: z.enum(['0', '1']).optional(),
    source: z.enum(['dashboard_diet', 'coach', 'marketplace']).optional(),
  }),
});

const dietSchema = z.object({
  query: z.object({
    locale: z.enum(['en', 'ar']).optional(),
    dayIndex: z.coerce.number().int().min(1).max(7).optional(),
  }),
});

const eventSchema = z.object({
  body: z.object({
    eventType: z.enum([...VALID_EVENTS]),
    source: z.string().min(1).max(64),
    sessionId: z.string().max(128).optional(),
    bundleId: z.string().max(128).optional(),
    productId: z.string().uuid().optional(),
    productIds: z.array(z.string().uuid()).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

router.get('/recommendations', validate(listSchema), async (req, res, next) => {
  const locale = req.query.locale === 'en' ? 'en' : 'ar';
  const bypassCache = req.query.refresh === '1';

  try {
    if (!bypassCache) {
      try {
        const cached = await getCachedRecommendations(req.user.id, locale);
        const minItems = getCommerceSettings().bundleDiscountMinItems || 3;
        const cachedCount = cached?.products?.length ?? 0;
        if (cached && !cached.empty && cachedCount >= minItems) {
          return res.json({ bundle: cached, cached: true });
        }
      } catch (cacheErr) {
        if (!isDbBusyError(cacheErr)) throw cacheErr;
      }
    }

    const bundle = await getPlanProductRecommendations(req.user.id, {
      locale,
      sessionId: req.query.sessionId,
    });

    if (!bundle.empty) {
      try {
        await setCachedRecommendations(req.user.id, locale, bundle);
      } catch (cacheErr) {
        if (!isDbBusyError(cacheErr)) throw cacheErr;
      }
      const eventSource =
        req.query.source === 'coach'
          ? 'coach_chat'
          : req.query.source === 'marketplace'
            ? 'marketplace'
            : 'dashboard_diet';
      void recordRecommendationEvent({
        userId: req.user.id,
        eventType: 'shown',
        source: eventSource,
        bundleId: bundle.bundleId,
        productIds: bundle.products.map((p) => p.product.id),
        sessionId: bundle.sessionId,
        metadata: {
          experimentId: bundle.abTest?.experimentId ?? null,
          abVariant: bundle.abTest?.variantKey ?? null,
          variantKey: bundle.abTest?.variantKey ?? null,
        },
      });
    }

    res.json({ bundle });
  } catch (err) {
    if (isDbBusyError(err)) {
      return res.json({
        bundle: buildEmptyRecommendationBundle(locale, req.query.sessionId),
        degraded: true,
      });
    }
    next(err);
  }
});

router.get('/diet-products', validate(dietSchema), async (req, res, next) => {
  const locale = req.query.locale === 'en' ? 'en' : 'ar';

  try {
    const dietProducts = await getDietPlanShopProducts(req.user.id, {
      locale,
      dayIndex: req.query.dayIndex,
    });

    if (!dietProducts.empty) {
      void recordRecommendationEvent({
        userId: req.user.id,
        eventType: 'shown',
        source: 'diet_plan',
        productIds: dietProducts.products.map((p) => p.product.id),
      });
    }

    res.json({ dietProducts });
  } catch (err) {
    if (isDbBusyError(err)) {
      return res.json({ dietProducts: emptyDietProducts(locale), degraded: true });
    }
    next(err);
  }
});

router.post('/events', validate(eventSchema), async (req, res, next) => {
  try {
    const row = await recordRecommendationEvent({
      userId: req.user.id,
      ...req.body,
    });
    res.status(201).json({ ok: true, eventId: row?.id ?? null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
