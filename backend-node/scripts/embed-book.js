/* eslint-disable no-console */
/**
 * Backfill embeddings on book_chunks (Mongo).
 *
 *   node scripts/embed-book.js
 *
 * Requires MONGO_URI + one of OPENAI_API_KEY / VOYAGE_API_KEY / OLLAMA_BASE_URL.
 * Re-embeds chunks whose embeddingModel does not match the active provider.
 */
require('dotenv').config();

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

async function main() {
  if (!isMongoConfigured()) {
    console.error('MONGO_URI is not configured.');
    process.exit(1);
  }
  if (!isEmbeddingsConfigured()) {
    console.error('No embeddings provider configured. Set OPENAI_API_KEY or VOYAGE_API_KEY or OLLAMA_BASE_URL.');
    process.exit(1);
  }

  await connectMongo();
  const BookChunk = require('../src/db/mongo/models/bookChunk');
  const { model } = providerInfo();
  console.log(`Embedding provider: ${model}`);

  const pending = await BookChunk.find({
    $or: [{ embedding: { $exists: false } }, { embeddingModel: { $ne: model } }],
  })
    .select('_id topic text embeddingModel')
    .lean();

  if (!pending.length) {
    console.log('All chunks already embedded with the current model.');
    await disconnectMongo();
    process.exit(0);
  }

  console.log(`Embedding ${pending.length} chunk(s)…`);
  let done = 0;
  for (let i = 0; i < pending.length; i += BATCH) {
    const slice = pending.slice(i, i + BATCH);
    const texts = slice.map((s) => `${s.topic}\n\n${s.text}`);
    const vectors = await embed(texts);
    if (!vectors) {
      console.error('Provider returned no vectors; aborting.');
      process.exit(1);
    }
    await Promise.all(
      slice.map((s, idx) =>
        BookChunk.updateOne(
          { _id: s._id },
          {
            $set: {
              embedding: vectors[idx],
              embeddingModel: model,
            },
          }
        )
      )
    );
    done += slice.length;
    console.log(`  ${done}/${pending.length}`);
  }

  console.log('Done.');
  await disconnectMongo();
  process.exit(0);
}

main().catch((err) => {
  console.error('embed-book failed:', err);
  process.exit(1);
});
