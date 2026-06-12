/* eslint-disable no-console */
/**
 * Block B4 — Ingest L3 (FoodItem + WebtebFood) into Postgres pgvector.
 *
 *   node scripts/rag/ingest-l3-foods.js
 *   node scripts/rag/ingest-l3-foods.js --limit=500
 *   node scripts/rag/ingest-l3-foods.js --dry-run
 *   node scripts/rag/ingest-l3-foods.js --skip-embed
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
  purgeLevel,
  embedChunkRows,
  providerInfo,
  isEmbeddingsConfigured,
} = require('../lib/pgvectorIngest');

const L3_LEVEL = 'L3_NUTRITION';
const SOURCE_FOOD = 'l3:foodItem:';
const SOURCE_WEBTEB = 'l3:webteb:';

const args = process.argv.slice(2);
const argSet = new Set(args);
const dryRun = argSet.has('--dry-run');
const skipEmbed = argSet.has('--skip-embed');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Math.min(Number(limitArg.split('=')[1]) || 0, 20000) : Infinity;

function macroLine(row) {
  return `Macros per 100g: ${Math.round(row.calories || 0)} kcal | protein ${Math.round(row.protein || 0)}g | carbs ${Math.round(row.carbs || 0)}g | fat ${Math.round(row.fat || 0)}g`;
}

function summarizeServingUnits(units) {
  if (!Array.isArray(units) || !units.length) return null;
  const parts = units.slice(0, 5).map((u) => {
    const label = u.label || u.name || 'unit';
    const grams = u.grams ?? u.amount ?? u.weight;
    return grams != null ? `${label} (${grams}g)` : label;
  });
  return `Serving units: ${parts.join('; ')}`;
}

function summarizeNutrientSection(rows, label, max = 6) {
  if (!Array.isArray(rows) || !rows.length) return null;
  const preview = rows
    .slice(0, max)
    .map((r) => `${r.name}: ${r.amount ?? '?'}${r.unit || ''}`)
    .join(', ');
  return `${label}: ${preview}`;
}

function summarizeSections(sections) {
  if (!sections || typeof sections !== 'object') return null;
  const lines = [];
  const vitamins = summarizeNutrientSection(sections.vitamins, 'Vitamins');
  const minerals = summarizeNutrientSection(sections.minerals, 'Minerals');
  if (vitamins) lines.push(vitamins);
  if (minerals) lines.push(minerals);
  return lines.length ? lines.join('\n') : null;
}

function bilingualNames({ nameEn, nameAr, fallback }) {
  const lines = [];
  if (nameAr) lines.push(`Name (Arabic): ${nameAr}`);
  if (nameEn) lines.push(`Name (English): ${nameEn}`);
  if (!nameAr && !nameEn && fallback) lines.push(`Name: ${fallback}`);
  lines.push(
    'Display: use Arabic name when user locale is ar; use English name when locale is en and nameEn is set.'
  );
  return lines.join('\n');
}

function buildFoodItemContent(row, webtebLinked) {
  const title = webtebLinked?.nameEn || webtebLinked?.nameAr || row.name;
  return [
    `# ${title}`,
    bilingualNames({
      nameAr: webtebLinked?.nameAr,
      nameEn: webtebLinked?.nameEn || row.name,
      fallback: row.name,
    }),
    'Source: Taqwin FoodItem (Postgres food_items)',
    `foodItemId: ${row.id}`,
    row.webtebId ? `webtebId: ${row.webtebId}` : null,
    row.fdcId ? `fdcId: ${row.fdcId}` : null,
    `Category: ${row.category || 'general'}`,
    macroLine(row),
    webtebLinked ? summarizeServingUnits(webtebLinked.servingUnits) : null,
    webtebLinked ? summarizeSections(webtebLinked.sections) : null,
    'Use in Taqwin diet plans and chat via foodItemId UUID.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildWebtebContent(row) {
  const display = row.nameEn || row.nameAr;
  return [
    `# ${display}`,
    bilingualNames({ nameAr: row.nameAr, nameEn: row.nameEn, fallback: display }),
    'Source: Webteb nutrition catalog (webteb_foods)',
    `webtebFoodId: ${row.id}`,
    `webtebId: ${row.webtebId}`,
    row.url ? `URL: ${row.url}` : null,
    `Category: ${row.categorySlug || row.categoryId}`,
    macroLine(row),
    summarizeServingUnits(row.servingUnits),
    summarizeSections(row.sections),
    'Use in Taqwin diet plans via webtebId integer in meal items.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

async function loadSources() {
  const take = Number.isFinite(limit) ? limit : undefined;

  const foodItems = await prisma.foodItem.findMany({
    where: { isPublic: true },
    take,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      fdcId: true,
      webtebId: true,
      name: true,
      category: true,
      calories: true,
      protein: true,
      carbs: true,
      fat: true,
    },
  });

  const linkedWebtebIds = new Set(
    foodItems.map((f) => f.webtebId).filter((id) => id != null)
  );

  const webteb = await prisma.webtebFood.findMany({
    take,
    orderBy: { nameAr: 'asc' },
    select: {
      id: true,
      webtebId: true,
      categoryId: true,
      categorySlug: true,
      slug: true,
      nameAr: true,
      nameEn: true,
      url: true,
      calories: true,
      protein: true,
      carbs: true,
      fat: true,
      servingUnits: true,
      sections: true,
    },
  });

  const webtebById = new Map(webteb.map((w) => [w.webtebId, w]));
  const webtebOnly = webteb.filter((w) => !linkedWebtebIds.has(w.webtebId));

  return { foodItems, webtebOnly, webtebById };
}

async function main() {
  console.log('Block B4 — L3 food ingest → Postgres knowledge_documents / knowledge_chunks');
  if (dryRun) console.log('(dry-run — no writes)\n');
  if (skipEmbed) console.log('(--skip-embed)\n');

  const { foodItems, webtebOnly, webtebById } = await loadSources();
  const total = foodItems.length + webtebOnly.length;

  if (!total) {
    console.error('No foods found.');
    process.exit(1);
  }

  console.log(
    `Found ${foodItems.length} FoodItem(s) + ${webtebOnly.length} Webteb-only (${total} total, skipping Webteb rows already linked to FoodItem).`
  );

  if (dryRun) {
    console.log(`[dry-run] Would create ${total} L3 documents.`);
    process.exit(0);
  }

  const purged = await purgeLevel(prisma, L3_LEVEL);
  if (purged) console.log(`Purged ${purged} previous L3 document(s).`);

  const chunkRows = [];
  let created = 0;

  const ingestRow = async ({ source, title, locale, storagePath, metadata, content }) => {
    const doc = await prisma.knowledgeDocument.create({
      data: {
        level: L3_LEVEL,
        source,
        title,
        locale,
        storagePath,
        metadata,
      },
    });
    const chunk = await prisma.knowledgeChunk.create({
      data: {
        documentId: doc.id,
        content,
        metadata: { level: L3_LEVEL, ...metadata, tokens: approxTokens(content) },
      },
    });
    chunkRows.push({ id: chunk.id, content });
    created += 1;
    if (created % 500 === 0) console.log(`  documents: ${created}/${total}`);
  };

  for (const row of foodItems) {
    const linked = row.webtebId ? webtebById.get(row.webtebId) : null;
    const content = buildFoodItemContent(row, linked);
    await ingestRow({
      source: `${SOURCE_FOOD}${row.id}`,
      title: row.name,
      locale: 'en',
      storagePath: `food_items/${row.id}`,
      metadata: {
        foodSource: 'foodItem',
        foodItemId: row.id,
        webtebId: row.webtebId,
        fdcId: row.fdcId,
        name: row.name,
        category: row.category,
      },
      content,
    });
  }

  for (const row of webtebOnly) {
    const content = buildWebtebContent(row);
    const title = row.nameEn || row.nameAr;
    await ingestRow({
      source: `${SOURCE_WEBTEB}${row.id}`,
      title,
      locale: row.nameAr ? 'ar' : 'en',
      storagePath: `webteb_foods/${row.id}`,
      metadata: {
        foodSource: 'webteb',
        webtebFoodId: row.id,
        webtebId: row.webtebId,
        nameAr: row.nameAr,
        nameEn: row.nameEn,
        categorySlug: row.categorySlug,
      },
      content,
    });
  }

  let embedded = 0;
  if (!skipEmbed && chunkRows.length) {
    const { model } = providerInfo();
    console.log(`Embedding ${chunkRows.length} chunk(s) with ${model}…`);
    embedded = await embedChunkRows(prisma, chunkRows, { skipEmbed });
  }

  const counts = await prisma.$queryRaw`
    SELECT
      (SELECT COUNT(*)::int FROM knowledge_documents WHERE level = 'L3_NUTRITION') AS docs,
      (SELECT COUNT(*)::int FROM knowledge_chunks k
        JOIN knowledge_documents d ON d.id = k.document_id
        WHERE d.level = 'L3_NUTRITION') AS chunks,
      (SELECT COUNT(*)::int FROM knowledge_chunks k
        JOIN knowledge_documents d ON d.id = k.document_id
        WHERE d.level = 'L3_NUTRITION' AND k.embedding IS NOT NULL) AS embedded
  `;
  const { docs, chunks, embedded: totalEmbedded } = counts[0];
  console.log(`\nL3 totals: ${docs} documents, ${chunks} chunks (${totalEmbedded} with embeddings).`);
  console.log(`This run: +${created} docs, +${embedded} embedded this session.`);
}

main()
  .catch((err) => {
    console.error('Ingest failed:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
