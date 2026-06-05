/**
 * Block A3 — HTTP client for taqwin-ai (FastAPI). Node proxies /api/ai/chat when enabled.
 */
const { logger } = require('../lib/logger');

const DEFAULT_TIMEOUT_MS = 30_000;

function isFastApiBridgeEnabled() {
  const flag = (process.env.FEATURE_AI_VIA_FASTAPI || '').toLowerCase();
  if (flag !== 'true' && flag !== '1') return false;
  const base = (process.env.AI_SERVICE_URL || '').trim();
  return base.length > 0;
}

function getServiceBaseUrl() {
  return (process.env.AI_SERVICE_URL || '').trim().replace(/\/$/, '');
}

function getTimeoutMs() {
  const n = Number(process.env.AI_SERVICE_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

/** Map frontend/Node roles to FastAPI chat roles. */
function toFastApiMessages(messages) {
  return messages.map((m) => ({
    role: m.role === 'model' ? 'assistant' : m.role,
    content: m.content,
  }));
}

/**
 * @param {{
 *   userId: string,
 *   threadId?: string | null,
 *   messages: Array<{ role: string, content: string }>,
 *   locale?: string,
 *   contextBundle?: Record<string, unknown> | null,
 * }} opts
 * @returns {Promise<{ reply: string, toolCalls: unknown[], confirmationRequired: boolean, intent: string }>}
 */
async function chatViaFastApi(opts) {
  const base = getServiceBaseUrl();
  if (!base) {
    throw new Error('AI_SERVICE_URL is not configured');
  }

  const body = {
    userId: opts.userId,
    threadId: opts.threadId || null,
    messages: toFastApiMessages(opts.messages),
    locale: opts.locale || 'en',
    contextBundle: opts.contextBundle ?? null,
  };

  try {
    const res = await fetch(`${base}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(getTimeoutMs()),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`FastAPI chat ${res.status}: ${text.slice(0, 300)}`);
    }

    const data = await res.json();
    const reply = typeof data.reply === 'string' ? data.reply : '';
    return {
      reply,
      toolCalls: Array.isArray(data.toolCalls) ? data.toolCalls : [],
      confirmationRequired: Boolean(data.confirmationRequired),
      intent: typeof data.intent === 'string' ? data.intent : 'general',
    };
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      throw new Error(`FastAPI chat timed out after ${getTimeoutMs()}ms`);
    }
    throw err;
  }
}

/**
 * Probe FastAPI health (optional diagnostics).
 * @returns {Promise<boolean>}
 */
async function pingFastApiHealth() {
  const base = getServiceBaseUrl();
  if (!base) return false;
  try {
    const res = await fetch(`${base}/health`, { method: 'GET' });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.status === 'ok';
  } catch (err) {
    logger.debug({ err }, 'FastAPI health check failed');
    return false;
  }
}

/**
 * Block C1 — plan generation via FastAPI (Node validates + persists in C2).
 * @param {{
 *   userId: string,
 *   contextBundle: Record<string, unknown>,
 *   weekStart?: string | null,
 *   foods?: unknown[] | null,
 *   exercises?: unknown[] | null,
 *   bookChunks?: unknown[] | null,
 *   regenerationReason?: string,
 *   validationFeedback?: string,
 * }} opts
 * @returns {Promise<{ plan: object, explainabilityText: string, source: string, meta: object }>}
 */
async function planGenerateViaFastApi(opts) {
  const base = getServiceBaseUrl();
  if (!base) {
    throw new Error('AI_SERVICE_URL is not configured');
  }

  const planTimeoutMs = Number(process.env.AI_PLAN_SERVICE_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(planTimeoutMs) && planTimeoutMs > 0 ? planTimeoutMs : 120_000;

  const body = {
    userId: opts.userId,
    contextBundle: opts.contextBundle ?? {},
    weekStart: opts.weekStart ?? null,
    foods: opts.foods ?? null,
    exercises: opts.exercises ?? null,
    bookChunks: opts.bookChunks ?? null,
    regenerationReason: opts.regenerationReason ?? '',
    validationFeedback: opts.validationFeedback ?? '',
  };

  try {
    const res = await fetch(`${base}/plan/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`FastAPI plan/generate ${res.status}: ${text.slice(0, 300)}`);
    }

    const data = await res.json();
    return {
      plan: data.plan,
      explainabilityText: data.explainabilityText || '',
      source: data.source || 'scaffold',
      meta: data.meta || {},
    };
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      throw new Error(`FastAPI plan/generate timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}

/**
 * @param {{
 *   userId: string,
 *   contextBundle: Record<string, unknown>,
 *   snapshot?: Record<string, unknown> | null,
 *   decisionHint?: string,
 * }} opts
 */
async function planAdaptViaFastApi(opts) {
  const base = getServiceBaseUrl();
  if (!base) {
    throw new Error('AI_SERVICE_URL is not configured');
  }

  const body = {
    userId: opts.userId,
    contextBundle: opts.contextBundle ?? {},
    snapshot: opts.snapshot ?? null,
    decisionHint: opts.decisionHint || 'keep',
  };

  const res = await fetch(`${base}/plan/adapt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(getTimeoutMs()),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`FastAPI plan/adapt ${res.status}: ${text.slice(0, 300)}`);
  }

  return res.json();
}

module.exports = {
  isFastApiBridgeEnabled,
  chatViaFastApi,
  planGenerateViaFastApi,
  planAdaptViaFastApi,
  pingFastApiHealth,
  toFastApiMessages,
};
