const { getFrontendUrl } = require('./frontendUrl');

function parseOriginList(envValue) {
  if (!envValue) return [];
  return envValue
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function isVercelOrigin(origin) {
  try {
    const u = new URL(origin);
    return u.protocol === 'https:' && u.hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

/**
 * Origins allowed by the CORS middleware.
 * Production: FRONTEND_URL / CORS_ALLOWED_ORIGINS (comma-separated), plus
 * https://*.vercel.app when CORS_ALLOW_VERCEL is not "false".
 */
function getAllowedOrigins() {
  const explicit = [
    ...parseOriginList(process.env.FRONTEND_URL),
    ...parseOriginList(process.env.CORS_ALLOWED_ORIGINS),
  ];
  const uniqueExplicit = [...new Set(explicit)];

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const devDefaults = [
      getFrontendUrl(),
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
    ];
    return [...new Set([...devDefaults, ...uniqueExplicit])];
  }

  if (uniqueExplicit.length > 0) return uniqueExplicit;
  return [getFrontendUrl()];
}

function isVercelCorsEnabled() {
  return process.env.CORS_ALLOW_VERCEL !== 'false';
}

function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (isVercelCorsEnabled() && isVercelOrigin(origin)) return true;
  return false;
}

module.exports = {
  getAllowedOrigins,
  isOriginAllowed,
  isVercelOrigin,
  isVercelCorsEnabled,
};
