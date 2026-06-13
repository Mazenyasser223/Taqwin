/**
 * Tier 3 — aggregated RAG observability from Mongo agent traces.
 */
const { isMongoConfigured, isMongoReady } = require('../db/mongo/client');

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function avg(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * @param {object} opts
 * @param {number} [opts.hours=24]
 * @param {number} [opts.limit=5000]
 */
async function aggregateRagMetrics({ hours = 24, limit = 5000 } = {}) {
  if (!isMongoConfigured()) {
    return {
      configured: false,
      windowHours: hours,
      traceCount: 0,
      message: 'MongoDB not configured — agent traces unavailable',
    };
  }

  if (!isMongoReady()) {
    return {
      configured: false,
      windowHours: hours,
      traceCount: 0,
      message: 'MongoDB not connected — agent traces unavailable',
    };
  }

  const AgentTrace = require('../db/mongo/models/agentTrace');
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  let traces = [];
  try {
    traces = await AgentTrace.find({ createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('intent rag latencyMs success error createdAt')
      .lean()
      .maxTimeMS(8000);
  } catch (err) {
    return {
      configured: false,
      windowHours: hours,
      traceCount: 0,
      message: `MongoDB query failed: ${(err.message || 'unknown').slice(0, 120)}`,
    };
  }

  const byIntent = {};
  const byLevel = {};
  const scores = [];
  const latencies = [];
  const rerankLifts = [];
  const emptyQueries = [];
  const failureQueries = [];

  for (const row of traces) {
    const intent = row.intent || 'general';
    const rag = row.rag || {};
    const hitCount = Number(rag.hitCount) || 0;
    const levels = rag.levels || [];
    const query = rag.query || null;

    if (!byIntent[intent]) {
      byIntent[intent] = { total: 0, withHits: 0, empty: 0, scores: [], latencies: [] };
    }
    const bucket = byIntent[intent];
    bucket.total += 1;
    if (hitCount > 0) bucket.withHits += 1;
    else {
      bucket.empty += 1;
      if (query) emptyQueries.push({ query: String(query).slice(0, 200), intent });
    }

    if (typeof rag.avgScore === 'number') {
      scores.push(rag.avgScore);
      bucket.scores.push(rag.avgScore);
    }
    const ragMs = Number(rag.retrievalMs);
    if (ragMs > 0) {
      latencies.push(ragMs);
      bucket.latencies.push(ragMs);
    } else if (row.latencyMs > 0) {
      latencies.push(row.latencyMs);
      bucket.latencies.push(row.latencyMs);
    }

    if (typeof rag.rerankLiftAvg === 'number') {
      rerankLifts.push(rag.rerankLiftAvg);
    }

    for (const lv of levels) {
      if (!byLevel[lv]) byLevel[lv] = { total: 0, withHits: 0 };
      byLevel[lv].total += 1;
      if (hitCount > 0) byLevel[lv].withHits += 1;
    }

    if (!row.success || row.error) {
      failureQueries.push({
        query: query ? String(query).slice(0, 200) : null,
        intent,
        error: (row.error || 'unknown').slice(0, 120),
      });
    }
  }

  const sortedLat = [...latencies].sort((a, b) => a - b);
  const hitRateByIntent = {};
  for (const [intent, b] of Object.entries(byIntent)) {
    hitRateByIntent[intent] = {
      hitRate: b.total ? Number((b.withHits / b.total).toFixed(4)) : 0,
      emptyRate: b.total ? Number((b.empty / b.total).toFixed(4)) : 0,
      count: b.total,
      avgScore: Number(avg(b.scores).toFixed(4)),
      p95LatencyMs: Number(percentile([...b.latencies].sort((a, c) => a - c), 95).toFixed(1)),
    };
  }

  const hitRateByLevel = {};
  for (const [lv, b] of Object.entries(byLevel)) {
    hitRateByLevel[lv] = {
      hitRate: b.total ? Number((b.withHits / b.total).toFixed(4)) : 0,
      count: b.total,
    };
  }

  const total = traces.length || 1;
  const withHits = traces.filter((t) => (t.rag?.hitCount || 0) > 0).length;
  const emptyCount = traces.filter((t) => !(t.rag?.hitCount || 0)).length;

  const emptyFreq = new Map();
  for (const q of emptyQueries) {
    const key = `${q.intent}::${q.query}`;
    emptyFreq.set(key, (emptyFreq.get(key) || 0) + 1);
  }
  const topEmptyQueries = [...emptyFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([key, count]) => {
      const [intent, query] = key.split('::');
      return { intent, query, count };
    });

  const failFreq = new Map();
  for (const f of failureQueries) {
    const key = `${f.intent}::${f.query || f.error}`;
    failFreq.set(key, (failFreq.get(key) || 0) + 1);
  }
  const topFailureQueries = [...failFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([key, count]) => {
      const [intent, rest] = key.split('::');
      return { intent, queryOrError: rest, count };
    });

  return {
    configured: true,
    windowHours: hours,
    traceCount: traces.length,
    hitRate: Number((withHits / total).toFixed(4)),
    emptyRetrievalRate: Number((emptyCount / total).toFixed(4)),
    avgScore: Number(avg(scores).toFixed(4)),
    p95LatencyMs: Number(percentile(sortedLat, 95).toFixed(1)),
    avgLatencyMs: Number(avg(latencies).toFixed(1)),
    rerankLiftAvg: Number(avg(rerankLifts).toFixed(4)),
    hitRateByIntent,
    hitRateByLevel,
    topEmptyQueries,
    topFailureQueries,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { aggregateRagMetrics, percentile, avg };
