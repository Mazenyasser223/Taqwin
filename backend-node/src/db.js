/**
 * Taqwin — PostgreSQL client (Prisma).
 * Singleton so we don't open multiple connections.
 * Requires DATABASE_URL and: npm run db:generate (or postinstall).
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

module.exports = { prisma };
