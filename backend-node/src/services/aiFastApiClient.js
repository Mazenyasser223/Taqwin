/**
 * HTTP client: Node → FastAPI AI Coach (Phase 1 bridge).
 */
const { logger } = require('../lib/logger');

function getAiServiceUrl() {
  const raw = (process.env.AI_SERVICE_URL || '').trim();
  return raw ? raw.replace(/\/$/, '') : '';
}

function isAiServiceEnabled() {
  return Boolean(getAiServiceUrl());
}

/**
 * @param {object} params
 * @param {string} params.userId
 * @param {'en'|'ar'} params.locale
 * @param {Array<{role:string,content:string}>} params.messages
 * @param {object} params.contextBundle
 * @param {string|null|undefined} params.threadId
 * @returns {Promise<{ reply: string, mode?: string }>}
 */
async function chatViaFastApi({ userId, locale, messages, contextBundle, threadId }) {
  const base = getAiServiceUrl();
  const key = (process.env.AI_INTERNAL_KEY || '').trim();
  const timeoutMs = Number(process.env.AI_SERVICE_TIMEOUT_MS || 60_000);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${base}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'X-Internal-Key': key } : {}),
      },
      body: JSON.stringify({
        userId,
        locale,
        messages,
        contextBundle: contextBundle || {},
        threadId: threadId || null,
      }),
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const detail = data.detail || data.error || res.statusText;
      const err = new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
      err.status = res.status;
      throw err;
    }

    if (!data.reply || typeof data.reply !== 'string') {
      throw new Error('AI service returned invalid response');
    }

    return { reply: data.reply, mode: data.mode };
  } catch (err) {
    if (err.name === 'AbortError') {
      const e = new Error('AI service timeout');
      e.code = 'AI_SERVICE_TIMEOUT';
      throw e;
    }
    if (err.cause?.code === 'ECONNREFUSED' || err.message?.includes('fetch failed')) {
      const e = new Error('AI service unreachable');
      e.code = 'AI_SERVICE_DOWN';
      throw e;
    }
    logger.warn({ err: err.message, code: err.code }, 'FastAPI chat request failed');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  isAiServiceEnabled,
  getAiServiceUrl,
  chatViaFastApi,
};
