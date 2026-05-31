/* eslint-disable no-console */
/**
 * Backfill embeddings for the Postgres `exercises` table.
 *
 *   node scripts/embed-exercises.js
 *   node scripts/embed-exercises.js --limit=200
 *
 * Writes to the Mongo `exercise_embeddings` collection.
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
  const muscles = Array.isArray(row.primaryMuscles)
    ? row.primaryMuscles.slice(0, 3).join(', ')
    : '';
  return `${row.name} — ${row.category}${row.difficulty ? ` (${row.difficulty})` : ''}${muscles ? ` | ${muscles}` : ''}`;
}

async function main() {
  if (!isMongoConfigured()) throw new Error('MONGO_URI not set');
  if (!isEmbeddingsConfigured()) {
    throw new Error('No embeddings provider configured.');
  }

  await connectMongo();
  const ExerciseEmbedding = require('../src/db/mongo/models/exerciseEmbedding');
  const { model } = providerInfo();
  console.log(`Embedding model: ${model}`);

  const limit = Math.min(limitArg, 5000);
  const rows = await prisma.exercise.findMany({
    where: { isPublic: true },
    take: limit,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      category: true,
      difficulty: true,
      primaryMuscles: true,
    },
  });

  const existing = await ExerciseEmbedding.find({
    pgId: { $in: rows.map((r) => r.id) },
    embeddingModel: model,
  })
    .select('pgId')
    .lean();
  const have = new Set(existing.map((e) => e.pgId));
  const todo = rows.filter((r) => !have.has(r.id));
  console.log(`${todo.length} pending of ${rows.length}`);

  for (let i = 0; i < todo.length; i += BATCH) {
    const slice = todo.slice(i, i + BATCH);
    const texts = slice.map(buildText);
    const vectors = await embed(texts);
    if (!vectors) throw new Error('Provider returned no vectors');
    const ops = slice.map((row, idx) => ({
      updateOne: {
        filter: { pgId: row.id },
        update: {
          $set: {
            pgId: row.id,
            name: row.name,
            text: texts[idx],
            embedding: vectors[idx],
            embeddingModel: model,
            embeddingDim: vectors[idx].length,
          },
        },
        upsert: true,
      },
    }));
    await ExerciseEmbedding.bulkWrite(ops, { ordered: false });
    console.log(`  ${Math.min(i + slice.length, todo.length)}/${todo.length}`);
  }

  await disconnectMongo();
  process.exit(0);
}

main().catch((err) => {
  console.error('embed-exercises failed:', err);
  process.exit(1);
});
