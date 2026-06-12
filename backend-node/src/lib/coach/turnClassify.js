/**
 * Classify confirm / cancel / neutral for pending actions.
 * LLM-first when a pending preview exists; regex only when LLM is unavailable.
 * Chat execution uses POST /api/ai/chat/confirm with actionId — not free-text confirm.
 */
const { isFastApiBridgeEnabled, getServiceBaseUrl, getTimeoutMs } = require('../../services/aiFastApiClient');
const {
  hasCancelSignal,
  hasConfirmSignal,
  classifyTurnLocal,
} = require('./coachSemantics');
const { sanitizePendingPreview, sanitizePromptText } = require('../cag/sanitizeCag');

async function classifyTurnRemote(opts) {
  if (!isFastApiBridgeEnabled()) return 'neutral';
  const base = getServiceBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getTimeoutMs());
  try {
    const res = await fetch(`${base}/turn/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: String(sanitizePromptText(opts.message, 'userMessage') || opts.message),
        locale: opts.locale || 'ar',
        pendingPreview: sanitizePendingPreview(opts.pendingPreview) || null,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return 'neutral';
    const data = await res.json();
    const turn = data?.turn;
    if (turn === 'confirm' || turn === 'cancel' || turn === 'neutral') return turn;
    return 'neutral';
  } catch {
    return 'neutral';
  } finally {
    clearTimeout(timer);
  }
}

async function classifyTurn(message, opts = {}) {
  const locale = opts.locale === 'en' ? 'en' : 'ar';
  if (opts.pendingPreview) {
    const remote = await classifyTurnRemote({
      message,
      locale,
      pendingPreview: opts.pendingPreview,
    });
    if (remote !== 'neutral') return remote;
  }
  return classifyTurnLocal(message, locale);
}

module.exports = {
  classifyTurn,
  classifyTurnLocal,
  hasConfirmSignal,
  hasCancelSignal,
};
