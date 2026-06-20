/**
 * Taqwin — PostgreSQL client (Prisma).
 * Singleton so we don't open multiple connections.
 * Requires DATABASE_URL and: npm run db:generate (or postinstall).
 *
 * Supabase local dev:
 * - Prefer DATABASE_URL transaction pooler (:6543, pgbouncer=true) with a small connection_limit.
 * - Do NOT use DIRECT_URL / session pooler (:5432) for the API — it caps at ~15 clients project-wide
 *   and causes EMAXCONNSESSION + dashboard 500s when Prisma opens a larger pool.
 * - Best local option: `npm run db:up` + local DATABASE_URL (see root docker-compose.yml).
 */
const { PrismaClient } = require('../generated/prisma');

function ensureQueryParam(url, key, value) {
  if (!url || value == null || value === '') return url;
  const pattern = new RegExp(`${key}=[^&]+`);
  if (pattern.test(url)) {
    return url.replace(pattern, `${key}=${value}`);
  }
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${key}=${value}`;
}

function ensureConnectionLimit(url, limit) {
  if (!url || !Number.isFinite(limit) || limit < 1) return url;
  return ensureQueryParam(url, 'connection_limit', limit);
}

function isTransactionPoolerUrl(url) {
  return url.includes('pgbouncer=true') || url.includes(':6543/');
}

function resolveDatabaseUrl() {
  const pooled = process.env.DATABASE_URL || '';
  const direct = process.env.DIRECT_URL || '';
  const isProd = process.env.NODE_ENV === 'production';
  const limit = Number(process.env.PRISMA_CONNECTION_LIMIT || (isProd ? 5 : 2));
  const poolTimeout = Number(process.env.PRISMA_POOL_TIMEOUT || (isProd ? 10 : 20));

  function finalizeUrl(url) {
    if (!url) return url;
    return ensureQueryParam(ensureConnectionLimit(url, limit), 'pool_timeout', poolTimeout);
  }

  if (isProd) {
    return finalizeUrl(pooled);
  }

  if (pooled && isTransactionPoolerUrl(pooled)) {
    console.warn(
      `[db] Dev: using Supabase transaction pooler (DATABASE_URL) with connection_limit=${limit}, pool_timeout=${poolTimeout}.`,
    );
    return finalizeUrl(pooled);
  }

  if (direct) {
    console.warn(
      '[db] Dev: using DIRECT_URL with connection_limit=%s. For daily dev, prefer DATABASE_URL :6543 or local Docker Postgres.',
      Math.min(limit, 2),
    );
    return finalizeUrl(ensureConnectionLimit(direct, Math.min(limit, 2)));
  }

  if (pooled) {
    return finalizeUrl(pooled);
  }

  return pooled;
}

const prisma = new PrismaClient({
  datasources: {
    db: { url: resolveDatabaseUrl() },
  },
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

module.exports = { prisma };
