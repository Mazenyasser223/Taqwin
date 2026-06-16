/**
 * Taqwin — PostgreSQL client (Prisma).
 * Singleton so we don't open multiple connections.
 * Requires DATABASE_URL and: npm run db:generate (or postinstall).
 *
 * Local dev: when DATABASE_URL uses Supabase pooler (pgbouncer + connection_limit=1),
 * parallel API requests easily hit Prisma P2024. We prefer DIRECT_URL in development.
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
  const usesPooler =
    pooled.includes('pgbouncer=true') ||
    pooled.includes(':6543/') ||
    /connection_limit=1(?:&|$)/.test(pooled);

  if (!isProd && direct && usesPooler) {
    console.warn(
      '[db] Dev: using DIRECT_URL instead of Supabase pooler to reduce "Database is busy" (P2024) errors.',
    );
    return withConnectionLimit(direct, 3);
  }

  if (!isProd && usesPooler && !direct) {
    console.warn(
      '[db] Dev: DATABASE_URL uses Supabase pooler with a low connection limit. ' +
        'Set DIRECT_URL to the port-5432 URL, or use local Postgres (docker compose up -d).',
    );
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
