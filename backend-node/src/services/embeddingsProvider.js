/**
 * Embeddings provider — abstracts over OpenAI, Voyage, and Ollama.
 *
 * Resolution order (first one configured wins, override with EMBED_PROVIDER):
 *   1. OpenAI    — OPENAI_API_KEY,  model default text-embedding-3-small (1536 dims)
 *   2. Voyage    — VOYAGE_API_KEY,  model default voyage-3-large
 *   3. Ollama    — OLLAMA_BASE_URL, model default nomic-embed-text (768 dims)
 *
 * All providers return a fixed-length number[] vector. `embed(text)` accepts
 * either a single string or an array; the result shape matches.
 */
const { logger } = require('../lib/logger');

function resolveProvider() {
  const explicit = (process.env.EMBED_PROVIDER || '').toLowerCase();
  if (explicit === 'openai' && process.env.OPENAI_API_KEY) return 'openai';
  if (explicit === 'voyage' && process.env.VOYAGE_API_KEY) return 'voyage';
  if (explicit === 'ollama') return 'ollama';
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.VOYAGE_API_KEY) return 'voyage';
  if (process.env.OLLAMA_BASE_URL) return 'ollama';
  return null;
}

function isEmbeddingsConfigured() {
  return Boolean(resolveProvider());
}

function providerInfo() {
  const provider = resolveProvider();
  if (provider === 'openai') {
    return { provider, model: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small' };
  }
  if (provider === 'voyage') {
    return { provider, model: process.env.VOYAGE_EMBED_MODEL || 'voyage-3-large' };
  }
  if (provider === 'ollama') {
    return { provider, model: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text' };
  }
  return { provider: null, model: null };
}

/** Tier 3 — version tag for embedding lifecycle / reindex jobs. */
function embeddingVersion() {
  return String(process.env.RAG_EMBED_VERSION || '1').trim() || '1';
}

function embeddingIdentity() {
  const { provider, model } = providerInfo();
  return {
    provider,
    model,
    version: embeddingVersion(),
  };
}

async function embedWithOpenAI(texts) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`OpenAI embeddings ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.data.map((row) => row.embedding);
}

async function embedWithVoyage(texts) {
  const apiKey = process.env.VOYAGE_API_KEY;
  const model = process.env.VOYAGE_EMBED_MODEL || 'voyage-3-large';
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Voyage embeddings ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.data.map((row) => row.embedding);
}

async function embedWithOllama(texts) {
  const base = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const model = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
  // Ollama only supports one input per call as of writing; run sequentially.
  const out = [];
  for (const t of texts) {
    const res = await fetch(`${base}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: t }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Ollama embeddings ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    out.push(data.embedding);
  }
  return out;
}

/**
 * @param {string | string[]} input
 * @returns {Promise<number[] | number[][] | null>}
 */
async function embed(input) {
  const provider = resolveProvider();
  if (!provider) return null;

  const inputs = Array.isArray(input) ? input : [input];
  const sanitized = inputs.map((t) => String(t || '').slice(0, 8000).trim()).filter(Boolean);
  if (!sanitized.length) return Array.isArray(input) ? [] : null;

  try {
    let vectors;
    if (provider === 'openai') vectors = await embedWithOpenAI(sanitized);
    else if (provider === 'voyage') vectors = await embedWithVoyage(sanitized);
    else vectors = await embedWithOllama(sanitized);

    if (!Array.isArray(input)) return vectors[0] || null;
    return vectors;
  } catch (err) {
    const detail = err.cause?.message || err.cause?.code || err.message;
    logger.warn({ err: detail, provider }, 'embeddings call failed');
    return null;
  }
}

module.exports = {
  embed,
  isEmbeddingsConfigured,
  providerInfo,
  embeddingVersion,
  embeddingIdentity,
};
