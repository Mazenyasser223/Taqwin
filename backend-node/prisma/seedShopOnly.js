/**
 * Seed shop catalog only (run after migrate + prisma generate).
 * Usage: node prisma/seedShopOnly.js
 */
const { PrismaClient } = require('@prisma/client');
const { seedShopCatalog } = require('./shopCatalogSeed');

const prisma = new PrismaClient();

seedShopCatalog(prisma)
  .then((stats) => {
    console.log('[seedShopOnly] done', stats);
  })
  .catch((err) => {
    console.error('[seedShopOnly] error', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
