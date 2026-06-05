/* eslint-disable no-console */
/**
 * Backfill embeddings on book_chunks (Mongo).
 *
 *   node scripts/embed-book.js
 *
 * Requires MONGO_URI + one of OPENAI_API_KEY / VOYAGE_API_KEY / OLLAMA_BASE_URL.
 * Re-embeds chunks whose embeddingModel does not match the active provider.
 *
 * Voyage free tier: ~3 RPM — uses 22s delay between chunks (override RAG_EMBED_DELAY_MS).
 */
require('dotenv').config();

const {
  connectMongo,
  disconnectMongo,
  isMongoConfigured,
} = require('../src/db/mongo/client');
const {
  providerInfo,
  isEmbeddingsConfigured,
} = require('../src/services/embeddingsProvider');
const {
  getEmbedBatchSize,
  getEmbedDelayMs,
  sleep,
  embedBatchWithRetry,
} = require('./lib/embedBatch');

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
  const batchSize = getEmbedBatchSize(16);
  const delayMs = getEmbedDelayMs();
  console.log(`Embedding provider: ${model}`);
  if (delayMs > 0) {
    console.log(`Rate-limit delay: ${delayMs / 1000}s between batches (Voyage free tier)`);
  }

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
  for (let i = 0; i < pending.length; i += batchSize) {
    if (i > 0 && delayMs > 0) await sleep(delayMs);
    const slice = pending.slice(i, i + batchSize);
    const texts = slice.map((s) => `${s.topic}\n\n${s.text}`);
    const vectors = await embedBatchWithRetry(texts);
    if (!vectors) {
      console.error(`Provider returned no vectors at ${done}/${pending.length}; aborting.`);
      console.error('Re-run the same command to resume remaining chunks.');
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
