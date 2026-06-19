#!/usr/bin/env node
/* eslint-disable no-console */
/** Remove orphan community rows where posts were deleted without CASCADE. */
require('dotenv').config();
const { prisma } = require('../src/db');

async function deleteOrphans(table, postColumn = 'post_id') {
  const result = await prisma.$executeRawUnsafe(`
    DELETE FROM "${table}" s
    WHERE NOT EXISTS (
      SELECT 1 FROM "community_posts" p WHERE p."id" = s."${postColumn}"
    )
  `);
  return Number(result) || 0;
}

async function main() {
  const tables = [
    ['community_saved_posts', 'post_id'],
    ['community_post_likes', 'post_id'],
    ['community_post_reposts', 'post_id'],
    ['community_comments', 'post_id'],
    ['community_post_tags', 'post_id'],
  ];
  for (const [table, col] of tables) {
    const n = await deleteOrphans(table, col);
    if (n > 0) console.log(`[ensure-community-orphans] ${table}: removed ${n}`);
  }
  console.log('[ensure-community-orphans] OK');
}

main()
  .catch((e) => {
    console.error('[ensure-community-orphans] FAIL', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
