/**
 * Optional vector-search helpers — Phase 8.
 *
 * If MongoDB Atlas Vector Search is set up (the `vectorIndexName` env vars
 * point at real indexes) and an embeddings provider is configured, these
 * helpers rerank candidates by semantic similarity. Otherwise they return
 * `null` so callers can fall through to keyword/tag retrieval.
 *
 * To enable, in .env:
 *   MONGO_VECTOR_SEARCH=true
 *   MONGO_VECTOR_BOOK_INDEX=book_chunks_vector
 *   MONGO_VECTOR_FOOD_INDEX=food_embeddings_vector
 *   MONGO_VECTOR_EXERCISE_INDEX=exercise_embeddings_vector
 */
const { isMongoConfigured, connectMongo } = require('../../db/mongo/client');
const {
  embed,
  isEmbeddingsConfigured,
  providerInfo,
} = require('../../services/embeddingsProvider');
const { logger } = require('../logger');

function isEnabled() {
  return (
    String(process.env.MONGO_VECTOR_SEARCH || '').toLowerCase() === 'true' &&
    isMongoConfigured() &&
    isEmbeddingsConfigured()
  );
}

async function embedQuery(text) {
  if (!isEmbeddingsConfigured()) return null;
  const v = await embed(text);
  return Array.isArray(v) ? v : null;
}

async function searchVector({ Model, indexName, queryVector, limit, filter }) {
  if (!queryVector) return null;
  try {
    const pipeline = [
      {
        $vectorSearch: {
          index: indexName,
          path: 'embedding',
          queryVector,
          numCandidates: Math.max(50, limit * 8),
          limit,
          ...(filter ? { filter } : {}),
        },
      },
      {
        $project: {
          _id: 1,
          score: { $meta: 'vectorSearchScore' },
          pgId: 1,
          source: 1,
          name: 1,
          topic: 1,
          tags: 1,
          text: 1,
        },
      },
    ];
    return await Model.aggregate(pipeline).exec();
  } catch (err) {
    logger.warn({ err: err.message, indexName }, 'vector search failed — falling back');
    return null;
  }
}

/**
 * @returns {Promise<Array<{ topic, tags, text, score }> | null>}
 */
async function rerankBookChunks({ message, limit = 5 } = {}) {
  if (!isEnabled() || !message) return null;
  const indexName = process.env.MONGO_VECTOR_BOOK_INDEX;
  if (!indexName) return null;
  const queryVector = await embedQuery(message);
  if (!queryVector) return null;
  await connectMongo();
  const BookChunk = require('../../db/mongo/models/bookChunk');
  return searchVector({ Model: BookChunk, indexName, queryVector, limit });
}

/**
 * @returns {Promise<Array<{ pgId, source, name, score }> | null>}
 */
async function rerankFoods({ queryText, limit = 30 } = {}) {
  if (!isEnabled() || !queryText) return null;
  const indexName = process.env.MONGO_VECTOR_FOOD_INDEX;
  if (!indexName) return null;
  const queryVector = await embedQuery(queryText);
  if (!queryVector) return null;
  await connectMongo();
  const FoodEmbedding = require('../../db/mongo/models/foodEmbedding');
  return searchVector({ Model: FoodEmbedding, indexName, queryVector, limit });
}

async function rerankExercises({ queryText, limit = 40 } = {}) {
  if (!isEnabled() || !queryText) return null;
  const indexName = process.env.MONGO_VECTOR_EXERCISE_INDEX;
  if (!indexName) return null;
  const queryVector = await embedQuery(queryText);
  if (!queryVector) return null;
  await connectMongo();
  const ExerciseEmbedding = require('../../db/mongo/models/exerciseEmbedding');
  return searchVector({ Model: ExerciseEmbedding, indexName, queryVector, limit });
}

module.exports = {
  isEnabled,
  rerankBookChunks,
  rerankFoods,
  rerankExercises,
  embedQuery,
  providerInfo,
};
