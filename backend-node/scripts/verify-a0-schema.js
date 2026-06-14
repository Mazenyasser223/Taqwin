/* eslint-disable no-console */
/**
 * Block A0 verification — run after `npx prisma migrate deploy`.
 *
 *   node scripts/verify-a0-schema.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// Use DIRECT_URL (port 5432) — pooler :6543 often fails for one-off scripts.
const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Set DIRECT_URL or DATABASE_URL in backend-node/.env');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
});

const A0_TABLES = [
  'ai_memories',
  'ai_tool_executions',
  'workout_plans',
  'workout_plan_days',
  'workout_plan_exercises',
  'diet_plans',
  'diet_plan_days',
  'diet_plan_meals',
  'diet_plan_meal_items',
  'daily_athlete_plans',
  'body_metrics',
  'readiness_logs',
  'progress_snapshots',
  'plan_feedbacks',
  'plan_change_logs',
  'progress_photos',
  'knowledge_documents',
  'knowledge_chunks',
];

const A0_ENUMS = [
  'PlanSource',
  'PlanStatus',
  'LifeMode',
  'DailyPlanStatus',
  'AdaptationDecision',
  'KnowledgeLevel',
];

async function main() {
  console.log('Block A0 — schema verification');
  console.log(`DB: ${dbUrl.replace(/:[^:@/]+@/, ':***@').replace(/\?(.*)$/, '')}\n`);

  const tables = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY(${A0_TABLES})
    ORDER BY table_name
  `;
  const found = new Set(tables.map((r) => r.table_name));
  const missing = A0_TABLES.filter((t) => !found.has(t));

  console.log(`Tables: ${found.size}/${A0_TABLES.length}`);
  if (missing.length) {
    console.error('Missing tables:', missing.join(', '));
    process.exitCode = 1;
  } else {
    for (const t of A0_TABLES) console.log('  ✓', t);
  }

  const enums = await prisma.$queryRaw`
    SELECT t.typname AS name
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = ANY(${A0_ENUMS})
    ORDER BY t.typname
  `;
  const enumFound = new Set(enums.map((r) => r.name));
  const enumMissing = A0_ENUMS.filter((e) => !enumFound.has(e));

  console.log(`\nEnums: ${enumFound.size}/${A0_ENUMS.length}`);
  if (enumMissing.length) {
    console.error('Missing enums:', enumMissing.join(', '));
    process.exitCode = 1;
  } else {
    for (const e of A0_ENUMS) console.log('  ✓', e);
  }

  const ext = await prisma.$queryRaw`
    SELECT extname FROM pg_extension WHERE extname = 'vector'
  `;
  const hasVector = ext.length > 0;
  console.log(`\npgvector extension: ${hasVector ? 'enabled ✓' : 'not enabled (enable in Supabase → Database → Extensions)'}`);

  const emb = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'knowledge_chunks'
      AND column_name = 'embedding'
  `;
  console.log(
    `knowledge_chunks.embedding: ${emb.length ? 'present ✓' : 'missing — run Block B1: npm run db:migrate && npm run verify:b1'}`
  );

  // Smoke: create + delete AiToolExecution row (needs a user)
  const user = await prisma.user.findFirst({ select: { id: true, email: true } });
  if (!user) {
    console.warn('\nNo user in DB — skipping insert smoke test.');
  } else {
    const row = await prisma.aiToolExecution.create({
      data: {
        userId: user.id,
        toolName: 'a0_verify_stub',
        input: { ok: true },
        output: { verified: true },
        success: true,
        durationMs: 1,
      },
    });
    await prisma.aiToolExecution.delete({ where: { id: row.id } });
    console.log(`\nInsert smoke test (AiToolExecution): OK (user ${user.email})`);
  }

  console.log(process.exitCode === 1 ? '\nFAILED' : '\nBlock A0 verification passed.');
}

main()
  .catch((err) => {
    console.error('FAIL:', err.message);
    if (/Can't reach database/i.test(err.message)) {
      console.error('\nTips:');
      console.error('  • Check internet / Supabase project is not paused');
      console.error('  • Use DIRECT_URL (port 5432) in .env — not pooler :6543');
      console.error('  • Or verify in Supabase Dashboard → Table Editor (no script needed)');
    }
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
