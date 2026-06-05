/* eslint-disable no-console */
/**
 * Backfill embeddings for FoodItem + WebtebFood rows.
 *
 *   node scripts/embed-foods.js
 *   node scripts/embed-foods.js --limit=500
 *
 * Stores vectors in the Mongo `food_embeddings` collection keyed by Postgres id.
 * Re-embeds entries whose model doesn't match the active provider.
 */
require('dotenv').config();

const { prisma } = require('../src/db');
const {
  connectMongo,
  disconnectMongo,
  isMongoConfigured,
} = require('../src/db/mongo/client');
const {
  embed,
  providerInfo,
  isEmbeddingsConfigured,
} = require('../src/services/embeddingsProvider');

const BATCH = 16;
const limitArg = (() => {
  const m = process.argv.find((a) => a.startsWith('--limit='));
  return m ? Number(m.split('=')[1]) : Infinity;
})();

function buildText(row) {
  const macros = `${Math.round(row.calories || 0)}kcal P${Math.round(row.protein || 0)} C${Math.round(row.carbs || 0)} F${Math.round(row.fat || 0)} per 100g`;
  const cat = row.category || row.categorySlug || '';
  return `${row.name || row.nameEn || row.nameAr}${cat ? ` (${cat})` : ''} — ${macros}`;
}

async function backfill({ source, rows }) {
  const FoodEmbedding = require('../src/db/mongo/models/foodEmbedding');
  const { model } = providerInfo();
  const existing = await FoodEmbedding.find({
    source,
    pgId: { $in: rows.map((r) => r.id) },
    embeddingModel: model,
  })
    .select('pgId')
    .lean();
  const have = new Set(existing.map((e) => e.pgId));
  const todo = rows.filter((r) => !have.has(r.id));
  console.log(`  ${source}: ${todo.length} pending of ${rows.length}`);

  for (let i = 0; i < todo.length; i += BATCH) {
    const slice = todo.slice(i, i + BATCH);
    const texts = slice.map(buildText);
    const vectors = await embed(texts);
    if (!vectors) throw new Error('Provider returned no vectors');
    const ops = slice.map((row, idx) => ({
      updateOne: {
        filter: { source, pgId: row.id },
        update: {
          $set: {
            source,
            pgId: row.id,
            webtebId: row.webtebId ?? null,
            name: row.name || row.nameEn || row.nameAr,
            text: texts[idx],
            embedding: vectors[idx],
            embeddingModel: model,
            embeddingDim: vectors[idx].length,
          },
        },
        upsert: true,
      },
    }));
    await FoodEmbedding.bulkWrite(ops, { ordered: false });
    console.log(`    ${Math.min(i + slice.length, todo.length)}/${todo.length}`);
  }
}

async function main() {
  if (!isMongoConfigured()) throw new Error('MONGO_URI not set');
  if (!isEmbeddingsConfigured()) {
    throw new Error('No embeddings provider configured. Set OPENAI_API_KEY, VOYAGE_API_KEY, or OLLAMA_BASE_URL.');
  }

  await connectMongo();
  const { model } = providerInfo();
  console.log(`Embedding model: ${model}`);

  const limit = Math.min(limitArg, 5000);

  const foodItems = await prisma.foodItem.findMany({
    where: { isPublic: true },
    take: limit,
    orderBy: { name: 'asc' },
    select: { id: true, name: true, category: true, calories: true, protein: true, carbs: true, fat: true, webtebId: true },
  });
  const webteb = await prisma.webtebFood.findMany({
    take: limit,
    orderBy: { protein: 'desc' },
    select: { id: true, webtebId: true, nameEn: true, nameAr: true, categorySlug: true, calories: true, protein: true, carbs: true, fat: true },
  });

  console.log(`Loaded ${foodItems.length} foodItems and ${webteb.length} webtebFoods.`);
  await backfill({ source: 'foodItem', rows: foodItems });
  await backfill({ source: 'webteb', rows: webteb.map((r) => ({ ...r, name: r.nameEn || r.nameAr })) });

  await disconnectMongo();
  process.exit(0);
}

main().catch((err) => {
  console.error('embed-foods failed:', err);
  process.exit(1);
});
