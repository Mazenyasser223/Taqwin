/**
 * In-process notification emit counters — logged periodically for observability.
 */
const { logger } = require('../logger');

const COUNTERS = {
  created: 0,
  grouped: 0,
  deduped: 0,
  quietHoursPending: 0,
  rateLimited: 0,
  publishFailed: 0,
  groupRaceRetries: 0,
};

const FLUSH_INTERVAL_MS = Math.max(60_000, Number(process.env.NOTIFICATION_METRICS_FLUSH_MS || 300_000));
let flushTimer = null;

function inc(key, n = 1) {
  if (COUNTERS[key] != null) COUNTERS[key] += n;
}

function snapshot() {
  return { ...COUNTERS, at: new Date().toISOString() };
}

function flushMetrics(reason = 'interval') {
  const snap = snapshot();
  const total =
    snap.created +
    snap.grouped +
    snap.deduped +
    snap.quietHoursPending +
    snap.rateLimited +
    snap.publishFailed;
  if (total === 0) return snap;
  logger.info({ notificationMetrics: snap, reason }, 'notification emit metrics');
  return snap;
}

function startMetricsFlush() {
  if (flushTimer) return;
  flushTimer = setInterval(() => flushMetrics('interval'), FLUSH_INTERVAL_MS);
  if (typeof flushTimer.unref === 'function') flushTimer.unref();
}

function resetMetricsForTest() {
  for (const k of Object.keys(COUNTERS)) COUNTERS[k] = 0;
}

module.exports = {
  inc,
  snapshot,
  flushMetrics,
  startMetricsFlush,
  resetMetricsForTest,
  COUNTERS,
};
