/**
 * Taqwin — PostgreSQL client (Prisma).
 * Singleton so we don't open multiple connections.
 * Requires DATABASE_URL and: npm run db:generate (or postinstall).
 *
 * Local dev: when DATABASE_URL uses Supabase pooler (pgbouncer + connection_limit=1),
 * parallel API requests easily hit Prisma P2024. We prefer DIRECT_URL in development.
 */
const { PrismaClient } = require('../generated/prisma');

function isPoolerUrl(url) {
  return (
    url.includes('pgbouncer=true') ||
    url.includes('.pooler.supabase.com') ||
    url.includes(':6543/') ||
    /connection_limit=1(?:&|$)/.test(url)
  );
}

/** True direct Postgres (local Docker or db.*.supabase.co) — not Supabase session pooler. */
function isDirectPostgresUrl(url) {
  if (!url || isPoolerUrl(url)) return false;
  return (
    url.includes('127.0.0.1') ||
    url.includes('localhost') ||
    /db\.[^/]+\.supabase\.co:5432/.test(url)
  );
}

function resolveDatabaseUrl() {
  const pooled = process.env.DATABASE_URL || '';
  const direct = process.env.DIRECT_URL || '';

  const isProd = process.env.NODE_ENV === 'production';
  const usesPooler = isPoolerUrl(pooled);

  if (!isProd && usesPooler && isDirectPostgresUrl(direct)) {
    console.warn(
      '[db] Dev: using DIRECT_URL instead of Supabase pooler to reduce "Database is busy" (P2024) errors.',
    );
    return direct;
  }

  if (!isProd && usesPooler && direct && isPoolerUrl(direct)) {
    console.warn(
      '[db] Dev: DIRECT_URL uses Supabase session pooler (:5432). ' +
        'Using DATABASE_URL (transaction pooler :6543) instead — session pooler exhausts connections quickly. ' +
        'For local dev, prefer docker compose up -d or set DIRECT_URL to db.PROJECT_REF.supabase.co:5432.',
    );
  }

  if (!isProd && usesPooler && !isDirectPostgresUrl(direct)) {
    console.warn(
      '[db] Dev: DATABASE_URL uses Supabase pooler. ' +
        'Set DIRECT_URL to db.PROJECT_REF.supabase.co:5432, or use local Postgres (docker compose up -d).',
    );
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
