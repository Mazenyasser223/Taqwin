/**
 * OAuth redirect origin — use the SPA origin that started sign-in (dev ports vary).
 */
const { getFrontendUrl } = require('./frontendUrl');
const { getAllowedOrigins, isOriginAllowed } = require('./corsOrigins');

function normalizeOrigin(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    return url.origin;
  } catch {
    return null;
  }
}

function resolveOAuthOrigin(req) {
  const allowed = getAllowedOrigins();
  const fromQuery = normalizeOrigin(req.query.origin);
  if (fromQuery && isOriginAllowed(fromQuery, allowed)) {
    return fromQuery;
  }

  const referer = req.get('referer');
  if (referer) {
    const fromReferer = normalizeOrigin(referer);
    if (fromReferer && isOriginAllowed(fromReferer, allowed)) {
      return fromReferer;
    }
  }

  return getFrontendUrl();
}

function buildOAuthState(flow, origin) {
  return `${flow}|${origin}`;
}

function parseOAuthState(stateRaw) {
  const fallback = { flow: 'login', origin: getFrontendUrl() };
  if (!stateRaw || typeof stateRaw !== 'string') return fallback;

  if (stateRaw === 'signup' || stateRaw === 'login') {
    return { flow: stateRaw, origin: getFrontendUrl() };
  }

  const sep = stateRaw.indexOf('|');
  if (sep <= 0) return fallback;

  const flow = stateRaw.slice(0, sep) === 'signup' ? 'signup' : 'login';
  const origin = stateRaw.slice(sep + 1);
  const normalized = normalizeOrigin(origin);
  if (normalized && isOriginAllowed(normalized, getAllowedOrigins())) {
    return { flow, origin: normalized };
  }

  return { ...fallback, flow };
}

module.exports = {
  resolveOAuthOrigin,
  buildOAuthState,
  parseOAuthState,
};
