#!/usr/bin/env node
/**
 * Load test — 1000 concurrent reactions on one post; verify actorCount and single row.
 *
 *   node scripts/load-test-notification-grouping.js
 *   REACTIONS=1000 node scripts/load-test-notification-grouping.js
 */
require('dotenv').config({ override: true });
const { randomUUID } = require('crypto');
const { prisma } = require('../src/db');
const { emitNotificationInternal } = require('../src/lib/notifications/notificationsCore');
const { snapshot, resetMetricsForTest } = require('../src/lib/notifications/notificationMetrics');

const REACTIONS = Math.max(10, Number(process.env.REACTIONS || 1000));
const POST_ID = process.env.POST_ID || randomUUID();

async function ensureRecipient() {
  let user = await prisma.user.findFirst({ where: { role: 'athlete' }, select: { id: true } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: `notif-load-${Date.now()}@test.local`,
        passwordHash: 'x',
        role: 'athlete',
      },
      select: { id: true },
    });
  }
  return user.id;
}

async function main() {
  const recipientId = await ensureRecipient();
  const groupKey = `group:community.reaction:post:${POST_ID}`;

  await prisma.notification.deleteMany({ where: { userId: recipientId, groupKey } });
  resetMetricsForTest();

  console.log({ recipientId, postId: POST_ID, reactions: REACTIONS, groupKey });

  const started = Date.now();
  const results = await Promise.all(
    Array.from({ length: REACTIONS }, (_, i) =>
      emitNotificationInternal({
        userId: recipientId,
        type: 'community.reaction',
        actorId: randomUUID(),
        actorDisplayName: `User${i}`,
        link: `/community/posts/${POST_ID}`,
        payload: { postId: POST_ID },
        _skipRateLimit: true,
      })
    )
  );
  const elapsedMs = Date.now() - started;

  const rows = await prisma.notification.findMany({
    where: { userId: recipientId, groupKey },
  });

  const row = rows[0];
  const metrics = snapshot();

  const report = {
    elapsedMs,
    rowCount: rows.length,
    actorCount: row?.actorCount ?? null,
    collapsedCount: row?.collapsedCount ?? null,
    expectedActorCount: REACTIONS,
    ok: rows.length === 1 && row?.actorCount === REACTIONS,
    metrics,
    nullResults: results.filter((r) => !r).length,
  };

  console.log(JSON.stringify(report, null, 2));

  await prisma.notification.deleteMany({ where: { userId: recipientId, groupKey } });

  if (!report.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
