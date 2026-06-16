/**
 * Per-user WebSocket rate limits (coach.send).
 */
const DEFAULT_MAX = Number(process.env.WS_COACH_RATE_MAX || process.env.AI_RATE_LIMIT_MAX || 20);
const WINDOW_MS = 60_000;

/** @type {Map<string, { count: number, resetAt: number }>} */
const buckets = new Map();

function checkCoachSendRate(userId) {
  if (!userId) return { allowed: false, retryAfterMs: WINDOW_MS };
  const now = Date.now();
  let bucket = buckets.get(userId);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(userId, bucket);
  }
  if (bucket.count >= DEFAULT_MAX) {
    return { allowed: false, retryAfterMs: Math.max(0, bucket.resetAt - now) };
  }
  bucket.count += 1;
  return { allowed: true, remaining: DEFAULT_MAX - bucket.count };
}

function resetCoachSendRate(userId) {
  if (userId) buckets.delete(userId);
}

module.exports = { checkCoachSendRate, resetCoachSendRate, WINDOW_MS, DEFAULT_MAX };
