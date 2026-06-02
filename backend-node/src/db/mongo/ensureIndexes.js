/**
 * Block A1 — sync Mongoose schema indexes to MongoDB (idempotent).
 * Called once after the first successful connection.
 */
const { mongoose } = require('./client');
const { logger } = require('../../lib/logger');

function loadModels() {
  require('./models/conversation');
  require('./models/message');
  require('./models/plan');
  require('./models/bookChunk');
  require('./models/foodEmbedding');
  require('./models/exerciseEmbedding');
}

/**
 * @returns {Promise<string[]>} collection names synced
 */
async function ensureMongoIndexes() {
  if (mongoose.connection?.readyState !== 1) {
    return [];
  }

  loadModels();
  const names = mongoose.modelNames();
  const synced = [];

  for (const name of names) {
    const model = mongoose.model(name);
    await model.syncIndexes();
    synced.push(model.collection.name);
  }

  if (synced.length) {
    logger.info({ collections: synced }, 'MongoDB indexes synced');
  }

  return synced;
}

module.exports = { ensureMongoIndexes };
