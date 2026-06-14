/* eslint-disable no-console */
/**
 * Block B3 — Ingest L2 (Exercise catalog) into Postgres pgvector.
 *
 *   node scripts/rag/ingest-l2-exercises.js
 *   node scripts/rag/ingest-l2-exercises.js --limit=100
 *   node scripts/rag/ingest-l2-exercises.js --dry-run
 *   node scripts/rag/ingest-l2-exercises.js --skip-embed
 */
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Set DIRECT_URL or DATABASE_URL in backend-node/.env');
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
const {
  approxTokens,
  splitWithOverlap,
  purgeLevel,
  embedChunkRows,
  setChunkSearchVector,
  providerInfo,
  isEmbeddingsConfigured,
} = require('../lib/pgvectorIngest');

const L2_LEVEL = 'L2_EXERCISE';
const SOURCE_PREFIX = 'l2:exercise:';
const MAX_CONTENT_CHARS = 8000;

const args = process.argv.slice(2);
const argSet = new Set(args);
const dryRun = argSet.has('--dry-run');
const skipEmbed = argSet.has('--skip-embed');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Math.min(Number(limitArg.split('=')[1]) || 0, 10000) : Infinity;

function asMuscleList(v) {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

function formatSteps(steps) {
  if (!Array.isArray(steps) || !steps.length) return '';
  return steps
    .map((s, i) => {
      if (typeof s === 'string') return `${i + 1}. ${s}`;
      if (s && typeof s === 'object') {
        const t = s.text || s.instruction || s.description || JSON.stringify(s);
        return `${i + 1}. ${t}`;
      }
      return null;
    })
    .filter(Boolean)
    .join('\n');
}

function buildExerciseContent(row) {
  const primary = asMuscleList(row.primaryMuscles);
  const secondary = asMuscleList(row.secondaryMuscles);
  const steps = formatSteps(row.steps);

  const lines = [
    `# ${row.name}`,
    row.nameAr ? `Arabic name: ${row.nameAr}` : null,
    `Exercise ID: ${row.id}`,
    `MuscleWiki ID: ${row.muscleWikiId}`,
    `Category: ${row.category || 'general'}`,
    row.difficulty ? `Difficulty: ${row.difficulty}` : null,
    row.force ? `Force: ${row.force}` : null,
    row.mechanic ? `Mechanic: ${row.mechanic}` : null,
    primary.length ? `Primary muscles: ${primary.join(', ')}` : null,
    secondary.length ? `Secondary muscles: ${secondary.join(', ')}` : null,
    row.longDescription ? `Description: ${row.longDescription}` : null,
    steps ? `Instructions:\n${steps}` : null,
    'Use this exercise in Taqwin workout plans via exerciseId UUID.',
  ].filter(Boolean);

  let content = lines.join('\n\n');
  if (content.length > MAX_CONTENT_CHARS) {
    content = `${content.slice(0, MAX_CONTENT_CHARS)}…`;
  }
  return content;
}

/** Canonical L2 template + searchable child slices (parent-child strategy). */
function buildExerciseChunkSpecs(row) {
  const primary = asMuscleList(row.primaryMuscles);
  const parentContent = buildExerciseContent(row);

  const searchHeader = [
    `# ${row.name}`,
    row.nameAr ? `Arabic: ${row.nameAr}` : null,
    `Exercise ID: ${row.id}`,
    row.muscleWikiId ? `MuscleWiki ID: ${row.muscleWikiId}` : null,
    primary.length ? `Primary muscles: ${primary.join(', ')}` : null,
    row.difficulty ? `Difficulty: ${row.difficulty}` : null,
    row.category ? `Category: ${row.category}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const specs = [{ role: 'parent', text: parentContent }];
  specs.push({ role: 'child', text: searchHeader, parentIndex: 0 });

  if (row.nameAr) {
    specs.push({
      role: 'child',
      text: `${row.nameAr} ${row.name} exercise ${primary.join(' ')}`,
      parentIndex: 0,
    });
  }

  const steps = formatSteps(row.steps);
  if (steps.length > 400) {
    for (const window of splitWithOverlap(steps)) {
      specs.push({ role: 'child', text: `# ${row.name} instructions\n${window}`, parentIndex: 0 });
    }
  }

  return specs;
}

async function ingestExerciseDoc(row) {
  const source = `${SOURCE_PREFIX}${row.id}`;
  const locale = row.nameAr ? 'ar' : 'en';
  const chunkSpecs = buildExerciseChunkSpecs(row);
  const baseMeta = {
    exerciseId: row.id,
    muscleWikiId: row.muscleWikiId,
    name: row.name,
    nameAr: row.nameAr,
    category: row.category,
    difficulty: row.difficulty,
    primaryMuscles: asMuscleList(row.primaryMuscles),
  };

  const doc = await prisma.knowledgeDocument.create({
    data: {
      level: L2_LEVEL,
      source,
      title: row.name,
      locale,
      storagePath: `exercises/${row.id}`,
      metadata: baseMeta,
    },
  });

  const idByIndex = new Map();
  const embeddable = [];

  for (let i = 0; i < chunkSpecs.length; i += 1) {
    const spec = chunkSpecs[i];
    const parentId =
      spec.parentIndex != null && idByIndex.has(spec.parentIndex)
        ? idByIndex.get(spec.parentIndex)
        : null;
    const chunk = await prisma.knowledgeChunk.create({
      data: {
        documentId: doc.id,
        content: spec.text,
        chunkRole: spec.role,
        parentId,
        metadata: {
          level: L2_LEVEL,
          ...baseMeta,
          tokens: approxTokens(spec.text),
          chunkRole: spec.role,
        },
      },
    });
    idByIndex.set(i, chunk.id);
    await setChunkSearchVector(prisma, chunk.id, spec.text, baseMeta);
    if (spec.role === 'child') {
      embeddable.push({ id: chunk.id, content: spec.text });
    }
  }

  return embeddable;
}

async function main() {
  console.log('Block B3 — L2 exercise ingest → Postgres knowledge_documents / knowledge_chunks');
  if (dryRun) console.log('(dry-run — no writes)\n');
  if (skipEmbed) console.log('(--skip-embed)\n');

  const rows = await prisma.exercise.findMany({
    where: { isPublic: true },
    take: Number.isFinite(limit) ? limit : undefined,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      muscleWikiId: true,
      name: true,
      nameAr: true,
      category: true,
      difficulty: true,
      force: true,
      mechanic: true,
      primaryMuscles: true,
      secondaryMuscles: true,
      steps: true,
      longDescription: true,
    },
  });

  if (!rows.length) {
    console.error('No public exercises found in Postgres.');
    process.exit(1);
  }

  console.log(`Found ${rows.length} exercise(s) to ingest.`);

  if (dryRun) {
    console.log(`[dry-run] Would create ${rows.length} L2 documents with 1 chunk each.`);
    process.exit(0);
  }

  const purged = await purgeLevel(prisma, L2_LEVEL);
  if (purged) console.log(`Purged ${purged} previous L2 document(s).`);

  const chunkRows = [];
  let created = 0;

  for (const row of rows) {
    const embeddable = await ingestExerciseDoc(row);
    chunkRows.push(...embeddable);
    created += 1;
    if (created % 100 === 0) console.log(`  documents: ${created}/${rows.length}`);
  }

  let embedded = 0;
  if (!skipEmbed && chunkRows.length) {
    const { model } = providerInfo();
    console.log(`Embedding ${chunkRows.length} chunk(s) with ${model}…`);
    embedded = await embedChunkRows(prisma, chunkRows, { skipEmbed });
  }

  const counts = await prisma.$queryRaw`
    SELECT
      (SELECT COUNT(*)::int FROM knowledge_documents WHERE level = 'L2_EXERCISE') AS docs,
      (SELECT COUNT(*)::int FROM knowledge_chunks k
        JOIN knowledge_documents d ON d.id = k.document_id
        WHERE d.level = 'L2_EXERCISE') AS chunks,
      (SELECT COUNT(*)::int FROM knowledge_chunks k
        JOIN knowledge_documents d ON d.id = k.document_id
        WHERE d.level = 'L2_EXERCISE' AND k.embedding IS NOT NULL) AS embedded
  `;
  const { docs, chunks, embedded: totalEmbedded } = counts[0];
  console.log(`\nL2 totals: ${docs} documents, ${chunks} chunks (${totalEmbedded} with embeddings).`);
  console.log(`This run: +${created} docs, +${embedded} embedded this session.`);
}

main()
  .catch((err) => {
    console.error('Ingest failed:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
