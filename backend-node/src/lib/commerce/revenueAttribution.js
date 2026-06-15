/**
 * Paid-order revenue grouped by attribution source.
 */
const { prisma } = require('../../db');
const { ORDER_SOURCES, normalizeCommerceSource } = require('./orderAttribution');

const SOURCE_LABELS = {
  [ORDER_SOURCES.AI_BUNDLE]: { en: 'AI Bundle', ar: 'باقة AI' },
  [ORDER_SOURCES.AI_RECOMMENDATION]: { en: 'AI Recommendations', ar: 'اقتراحات AI' },
  [ORDER_SOURCES.SEARCH]: { en: 'Search', ar: 'بحث' },
  [ORDER_SOURCES.CATEGORY]: { en: 'Categories', ar: 'أقسام' },
  [ORDER_SOURCES.FEATURED]: { en: 'Featured', ar: 'مميز' },
  [ORDER_SOURCES.DIRECT]: { en: 'Direct / Other', ar: 'مباشر / أخرى' },
};

const CHART_ORDER = [
  ORDER_SOURCES.AI_RECOMMENDATION,
  ORDER_SOURCES.AI_BUNDLE,
  ORDER_SOURCES.SEARCH,
  ORDER_SOURCES.FEATURED,
  ORDER_SOURCES.CATEGORY,
  ORDER_SOURCES.DIRECT,
];

/**
 * @param {{ days?: number }} [opts]
 */
async function getRevenueBySource(opts = {}) {
  const days = Math.min(Math.max(Number(opts.days) || 30, 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      paymentStatus: 'paid',
      paidAt: { gte: since },
    },
    select: {
      total: true,
      commerceSource: true,
    },
  });

  const buckets = new Map();
  let totalRevenue = 0;
  let attributedRevenue = 0;

  for (const o of orders) {
    const revenue = Number(o.total) || 0;
    totalRevenue += revenue;
    const source = normalizeCommerceSource(o.commerceSource) || ORDER_SOURCES.DIRECT;
    attributedRevenue += revenue;
    const row = buckets.get(source) || { source, revenue: 0, orders: 0 };
    row.revenue += revenue;
    row.orders += 1;
    buckets.set(source, row);
  }

  const bySource = CHART_ORDER.map((source) => {
    const row = buckets.get(source) || { source, revenue: 0, orders: 0 };
    const share = attributedRevenue > 0 ? (row.revenue / attributedRevenue) * 100 : 0;
    return {
      source,
      labelEn: SOURCE_LABELS[source]?.en || source,
      labelAr: SOURCE_LABELS[source]?.ar || source,
      revenue: Math.round(row.revenue * 100) / 100,
      orders: row.orders,
      sharePercent: Math.round(share * 10) / 10,
    };
  }).filter((r) => r.revenue > 0 || r.orders > 0);

  // Include any unexpected sources
  for (const [source, row] of buckets) {
    if (!CHART_ORDER.includes(source)) {
      bySource.push({
        source,
        labelEn: source,
        labelAr: source,
        revenue: Math.round(row.revenue * 100) / 100,
        orders: row.orders,
        sharePercent:
          attributedRevenue > 0
            ? Math.round((row.revenue / attributedRevenue) * 1000) / 10
            : 0,
      });
    }
  }

  const aiRevenue =
    (buckets.get(ORDER_SOURCES.AI_BUNDLE)?.revenue || 0) +
    (buckets.get(ORDER_SOURCES.AI_RECOMMENDATION)?.revenue || 0);
  const aiShare = attributedRevenue > 0 ? (aiRevenue / attributedRevenue) * 100 : 0;

  return {
    periodDays: days,
    since: since.toISOString(),
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    attributedRevenue: Math.round(attributedRevenue * 100) / 100,
    totalOrders: orders.length,
    aiRevenue: Math.round(aiRevenue * 100) / 100,
    aiSharePercent: Math.round(aiShare * 10) / 10,
    bySource,
  };
}

module.exports = { getRevenueBySource, SOURCE_LABELS, CHART_ORDER };
