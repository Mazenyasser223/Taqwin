/**
 * Shop conversion funnel — track + aggregate Visitor → Paid.
 */
const { prisma } = require('../../db');
const { isMissingShopTableError } = require('./prismaShopTables');

const STEPS = ['visit', 'search', 'product_view', 'add_to_cart', 'checkout_start', 'paid'];

function emptyFunnel(opts = {}) {
  const days = Math.min(Math.max(Number(opts.days) || 30, 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return {
    periodDays: days,
    since: since.toISOString(),
    steps: STEPS.map((step) => ({
      step,
      sessions: 0,
      conversionFromPrev: 0,
      conversionFromVisit: 0,
    })),
    visitCount: 0,
    paidCount: 0,
    overallConversion: 0,
    rawEventCounts: [],
    migrationPending: true,
  };
}

async function recordFunnelEvent({ userId, sessionId, step, productId, query, metadata }) {
  if (!sessionId || !STEPS.includes(step)) {
    const err = new Error(`Invalid funnel step: ${step}`);
    err.status = 400;
    throw err;
  }
  try {
    return await prisma.shopFunnelEvent.create({
      data: {
        userId: userId || null,
        sessionId: String(sessionId).slice(0, 128),
        step,
        productId: productId || null,
        query: query ? String(query).slice(0, 256) : null,
        metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
      },
    });
  } catch (err) {
    if (isMissingShopTableError(err)) return null;
    throw err;
  }
}

/**
 * Unique sessions per step + step-to-step conversion rates.
 * @param {{ days?: number }} [opts]
 */
async function getConversionFunnel(opts = {}) {
  const days = Math.min(Math.max(Number(opts.days) || 30, 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  let grouped;
  let uniqueByStep;
  try {
    grouped = await prisma.shopFunnelEvent.groupBy({
      by: ['step'],
      where: { createdAt: { gte: since } },
      _count: { sessionId: true },
    });

    uniqueByStep = await prisma.$queryRaw`
      SELECT step::text AS step, COUNT(DISTINCT session_id)::int AS sessions
      FROM shop_funnel_events
      WHERE created_at >= ${since}
      GROUP BY step
    `;
  } catch (err) {
    if (isMissingShopTableError(err)) return emptyFunnel(opts);
    throw err;
  }

  const sessionMap = new Map();
  for (const row of uniqueByStep) {
    sessionMap.set(row.step, Number(row.sessions) || 0);
  }

  const steps = STEPS.map((step, idx) => {
    const count = sessionMap.get(step) || 0;
    const prev = idx > 0 ? sessionMap.get(STEPS[idx - 1]) || 0 : count;
    const conversionFromPrev = prev > 0 ? Math.round((count / prev) * 1000) / 10 : 0;
    const conversionFromVisit =
      (sessionMap.get('visit') || 0) > 0
        ? Math.round((count / sessionMap.get('visit')) * 1000) / 10
        : 0;
    return {
      step,
      sessions: count,
      conversionFromPrev,
      conversionFromVisit,
    };
  });

  const visitCount = sessionMap.get('visit') || 0;
  const paidCount = sessionMap.get('paid') || 0;
  const overallConversion = visitCount > 0 ? Math.round((paidCount / visitCount) * 1000) / 10 : 0;

  return {
    periodDays: days,
    since: since.toISOString(),
    steps,
    visitCount,
    paidCount,
    overallConversion,
    rawEventCounts: grouped.map((g) => ({ step: g.step, events: g._count.sessionId })),
  };
}

module.exports = { recordFunnelEvent, getConversionFunnel, STEPS };
