/**
 * Rate-limit aware embedding batches (Voyage free tier ≈ 3 RPM).
 */
const { embed } = require('../../src/services/embeddingsProvider');

function getEmbedDelayMs() {
  return Number(
    process.env.RAG_EMBED_DELAY_MS ||
      ((process.env.EMBED_PROVIDER || '').toLowerCase() === 'voyage' ? 22000 : 0)
  );
}

function getEmbedBatchSize(defaultBatch = 16) {
  const voyageSequential =
    (process.env.EMBED_PROVIDER || '').toLowerCase() === 'voyage' &&
    process.env.RAG_EMBED_SEQUENTIAL !== 'false';
  return voyageSequential ? 1 : defaultBatch;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function embedBatchWithRetry(texts, { attempts = 4, delayMs } = {}) {
  const baseDelay = delayMs ?? getEmbedDelayMs();
  for (let i = 0; i < attempts; i += 1) {
    const vectors = await embed(texts);
    if (vectors && vectors.length) return vectors;
    if (i < attempts - 1) {
      const wait = baseDelay > 0 ? baseDelay * 2 ** i : 2000 * 2 ** i;
      console.log(`  … embed retry ${i + 2}/${attempts} in ${Math.round(wait / 1000)}s`);
      await sleep(wait);
    }
  }
  return null;
}

module.exports = {
  getEmbedDelayMs,
  getEmbedBatchSize,
  sleep,
  embedBatchWithRetry,
};
