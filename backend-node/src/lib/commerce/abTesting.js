/**
 * A/B tests for AI commerce bundles — assignment, metrics, auto-winner.
 */
const crypto = require('crypto');
const { prisma } = require('../../db');
const { logger } = require('../logger');

const DEFAULT_EXPERIMENT_SLUG = 'bundle-composition';

async function ensureDefaultExperiment() {
  let exp = await prisma.commerceExperiment.findUnique({
    where: { slug: DEFAULT_EXPERIMENT_SLUG },
    include: { variants: { orderBy: { key: 'asc' } } },
  });

  if (exp) return exp;

  exp = await prisma.commerceExperiment.create({
    data: {
      slug: DEFAULT_EXPERIMENT_SLUG,
      name: 'Bundle composition',
      status: 'active',
      minSamples: 50,
      variants: {
        create: [
          {
            key: 'A',
            name: 'Creatine + Whey',
            slotConfig: { includeShaker: false },
            weight: 50,
          },
          {
            key: 'B',
            name: 'Creatine + Whey + Shaker',
            slotConfig: { includeShaker: true },
            weight: 50,
          },
        ],
      },
    },
    include: { variants: { orderBy: { key: 'asc' } } },
  });
  return exp;
}

function hashBucket(userId, experimentId) {
  const digest = crypto.createHash('sha256').update(`${userId}:${experimentId}`).digest();
  return digest.readUInt32BE(0) % 100;
}

function pickVariantByWeight(variants, bucket) {
  const active = variants.filter((v) => v.weight > 0);
  if (!active.length) return variants[0] || null;
  let cumulative = 0;
  for (const v of active) {
    cumulative += v.weight;
    if (bucket < cumulative) return v;
  }
  return active[active.length - 1];
}

/**
 * Assign user to an experiment variant (sticky by userId hash).
 * @param {string} userId
 * @param {string} [experimentSlug]
 */
async function assignAbVariant(userId, experimentSlug = DEFAULT_EXPERIMENT_SLUG) {
  const exp = await ensureDefaultExperiment();
  if (exp.slug !== experimentSlug) {
    const other = await prisma.commerceExperiment.findUnique({
      where: { slug: experimentSlug },
      include: { variants: { orderBy: { key: 'asc' } } },
    });
    if (!other) return null;
    return assignForExperiment(userId, other);
  }
  return assignForExperiment(userId, exp);
}

function assignForExperiment(userId, exp) {
  if (exp.status === 'concluded' && exp.winnerVariantKey) {
    const winner = exp.variants.find((v) => v.key === exp.winnerVariantKey) || exp.variants[0];
    return {
      experimentId: exp.id,
      experimentSlug: exp.slug,
      experimentName: exp.name,
      variantKey: winner.key,
      variantName: winner.name,
      slotConfig: winner.slotConfig || {},
      status: exp.status,
    };
  }

  const bucket = hashBucket(userId, exp.id);
  const variant = pickVariantByWeight(exp.variants, bucket);
  if (!variant) return null;

  return {
    experimentId: exp.id,
    experimentSlug: exp.slug,
    experimentName: exp.name,
    variantKey: variant.key,
    variantName: variant.name,
    slotConfig: variant.slotConfig || {},
    status: exp.status,
  };
}

/**
 * Compute funnel metrics per variant from recommendation events + paid orders.
 */
async function getExperimentMetrics(experimentId, opts = {}) {
  const days = Math.min(Math.max(Number(opts.days) || 30, 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const exp = await prisma.commerceExperiment.findUnique({
    where: { id: experimentId },
    include: { variants: { orderBy: { key: 'asc' } } },
  });
  if (!exp) return null;

  const events = await prisma.recommendationEvent.findMany({
    where: {
      createdAt: { gte: since },
    },
    select: {
      eventType: true,
      metadata: true,
      orderId: true,
    },
  });

  const experimentEvents = events.filter((e) => {
    const meta = e.metadata && typeof e.metadata === 'object' ? e.metadata : {};
    return meta.experimentId === experimentId;
  });

  const orders = await prisma.order.findMany({
    where: {
      paymentStatus: 'paid',
      paidAt: { gte: since },
      commerceExperimentId: experimentId,
    },
    select: {
      total: true,
      commerceAbVariant: true,
    },
  });

  const metrics = new Map();
  for (const v of exp.variants) {
    metrics.set(v.key, {
      variantKey: v.key,
      variantName: v.name,
      weight: v.weight,
      isWinner: v.isWinner,
      shown: 0,
      clicked: 0,
      bundleAdded: 0,
      purchased: 0,
      revenue: 0,
      ctr: 0,
      addToCartRate: 0,
      purchaseRate: 0,
      revenuePerShown: 0,
    });
  }

  for (const e of experimentEvents) {
    const meta = e.metadata && typeof e.metadata === 'object' ? e.metadata : {};
    const key = meta.abVariant || meta.variantKey;
    if (!key || !metrics.has(key)) continue;
    const m = metrics.get(key);
    if (e.eventType === 'shown') m.shown += 1;
    if (e.eventType === 'clicked') m.clicked += 1;
    if (e.eventType === 'bundle_added') m.bundleAdded += 1;
    if (e.eventType === 'purchased') m.purchased += 1;
  }

  for (const o of orders) {
    const key = o.commerceAbVariant;
    if (!key || !metrics.has(key)) continue;
    metrics.get(key).revenue += Number(o.total) || 0;
    metrics.get(key).purchased += 1;
  }

  const variants = [...metrics.values()].map((m) => {
    m.ctr = m.shown > 0 ? Math.round((m.clicked / m.shown) * 10000) / 100 : 0;
    m.addToCartRate = m.shown > 0 ? Math.round((m.bundleAdded / m.shown) * 10000) / 100 : 0;
    m.purchaseRate = m.shown > 0 ? Math.round((m.purchased / m.shown) * 10000) / 100 : 0;
    m.revenue = Math.round(m.revenue * 100) / 100;
    m.revenuePerShown = m.shown > 0 ? Math.round((m.revenue / m.shown) * 100) / 100 : 0;
    return m;
  });

  return {
    experimentId: exp.id,
    slug: exp.slug,
    name: exp.name,
    status: exp.status,
    winnerVariantKey: exp.winnerVariantKey,
    minSamples: exp.minSamples,
    variants,
  };
}

/**
 * Promote winning variant when sample size + lift threshold met.
 */
async function maybeAutoPromoteWinner(experimentId) {
  const metrics = await getExperimentMetrics(experimentId, { days: 60 });
  if (!metrics || metrics.status === 'concluded' || metrics.variants.length < 2) return null;

  const [a, b] = metrics.variants;
  if (!a || !b) return null;
  if (a.shown < metrics.minSamples || b.shown < metrics.minSamples) return null;

  const score = (m) => m.purchaseRate * 0.6 + m.revenuePerShown * 0.4;
  const scoreA = score(a);
  const scoreB = score(b);
  const winner = scoreB > scoreA * 1.05 ? b : scoreA > scoreB * 1.05 ? a : null;
  if (!winner) return null;

  await prisma.$transaction([
    prisma.commerceExperiment.update({
      where: { id: experimentId },
      data: { status: 'concluded', winnerVariantKey: winner.variantKey },
    }),
    prisma.commerceExperimentVariant.updateMany({
      where: { experimentId },
      data: { isWinner: false, weight: 0 },
    }),
    prisma.commerceExperimentVariant.updateMany({
      where: { experimentId, key: winner.variantKey },
      data: { isWinner: true, weight: 100 },
    }),
  ]);

  logger.info(
    { experimentId, winner: winner.variantKey, scoreA, scoreB },
    'Commerce A/B auto-promoted winner'
  );

  return winner.variantKey;
}

async function getActiveAbTestSummary(opts = {}) {
  const exp = await ensureDefaultExperiment();
  void maybeAutoPromoteWinner(exp.id).catch(() => null);
  const metrics = await getExperimentMetrics(exp.id, opts);
  return metrics;
}

module.exports = {
  DEFAULT_EXPERIMENT_SLUG,
  ensureDefaultExperiment,
  assignAbVariant,
  getExperimentMetrics,
  maybeAutoPromoteWinner,
  getActiveAbTestSummary,
};
