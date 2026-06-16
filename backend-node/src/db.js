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

function withConnectionLimit(url, limit = 3) {
  if (!url || /connection_limit=\d+/i.test(url)) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}connection_limit=${limit}`;
}

function resolveDatabaseUrl() {
  const pooled = process.env.DATABASE_URL || '';
  const direct = process.env.DIRECT_URL || '';
  const isProd = process.env.NODE_ENV === 'production';
  const limit = Number(process.env.PRISMA_CONNECTION_LIMIT || (isProd ? 5 : 5));

  if (isProd) {
    return ensureConnectionLimit(pooled, limit);
  }

  if (pooled && isTransactionPoolerUrl(pooled)) {
    console.warn(
      `[db] Dev: using Supabase transaction pooler (DATABASE_URL) with connection_limit=${limit}.`,
    );
    return withConnectionLimit(direct, 3);
  }

  if (direct) {
    console.warn(
      '[db] Dev: using DIRECT_URL with connection_limit=%s. For daily dev, prefer DATABASE_URL :6543 or local Docker Postgres.',
      limit,
    );
    return ensureConnectionLimit(direct, Math.min(limit, 3));
  }

  if (pooled) {
    return ensureConnectionLimit(pooled, limit);
  }

  return isProd ? pooled : withConnectionLimit(pooled, 3);
}

const prisma = new PrismaClient({
  datasources: {
    db: { url: resolveDatabaseUrl() },
  },
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

module.exports = { prisma };
