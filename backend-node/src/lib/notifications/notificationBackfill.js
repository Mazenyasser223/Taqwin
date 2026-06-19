/**
 * Backfill legacy notifications with v2 metadata fields.
 */
const { prisma } = require('../../db');
const {
  SCHEMA_VERSION,
  categoryForType,
  priorityForType,
  iconForType,
} = require('./notificationConstants');

async function backfillNotifications({ batchSize = 500, dryRun = false, limit = 50_000 } = {}) {
  let processed = 0;
  let updated = 0;
  let lastId = null;

  while (processed < limit) {
    const rows = await prisma.notification.findMany({
      where: lastId ? { id: { gt: lastId } } : undefined,
      orderBy: { id: 'asc' },
      take: batchSize,
    });

    if (rows.length === 0) break;

    for (const row of rows) {
      processed += 1;
      lastId = row.id;

      const patch = {};
      const cat = categoryForType(row.type);
      if (!row.category || row.category === 'SYSTEM') patch.category = cat;
      const pri = priorityForType(row.type);
      if (row.priority === 'NORMAL' && pri !== 'NORMAL') patch.priority = pri;
      if (!row.schemaVersion || row.schemaVersion < SCHEMA_VERSION) patch.schemaVersion = SCHEMA_VERSION;
      if (!row.icon) patch.icon = iconForType(row.type);
      if (row.read && !row.readAt) patch.readAt = row.createdAt;

      if (Object.keys(patch).length === 0) continue;

      if (!dryRun) {
        await prisma.notification.update({ where: { id: row.id }, data: patch });
      }
      updated += 1;
    }

    if (rows.length < batchSize) break;
  }

  return { processed, updated, dryRun };
}

module.exports = { backfillNotifications };
