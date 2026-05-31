/**
 * MongoDB connection (mongoose).
 *
 * Postgres remains the primary store via Prisma. MongoDB holds AI-generated
 * artifacts that are flexible JSON: persisted coach plans (`DietPlan` +
 * `WorkoutPlan`), chat conversations, and RAG content (book chunks,
 * embeddings).
 *
 * Usage:
 *   const { connectMongo, isMongoReady } = require('./db/mongo/client');
 *   await connectMongo(); // safe to call many times
 */
const mongoose = require('mongoose');
const { logger } = require('../../lib/logger');

let connectPromise = null;
let warnedMissing = false;

function getMongoUri() {
  return process.env.MONGO_URI || process.env.MONGODB_URI || '';
}

function isMongoConfigured() {
  return Boolean(getMongoUri());
}

function isMongoReady() {
  return mongoose.connection?.readyState === 1;
}

/**
 * Establish (or reuse) the singleton mongoose connection.
 * Returns the mongoose instance, or null if MONGO_URI is missing.
 */
async function connectMongo() {
  if (!isMongoConfigured()) {
    if (!warnedMissing) {
      logger.warn('MongoDB not configured — set MONGO_URI to enable AI plan persistence.');
      warnedMissing = true;
    }
    return null;
  }

  if (isMongoReady()) return mongoose;
  if (connectPromise) return connectPromise;

  mongoose.set('strictQuery', true);

  connectPromise = mongoose
    .connect(getMongoUri(), {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
    })
    .then((m) => {
      logger.info({ host: mongoose.connection.host, db: mongoose.connection.name }, 'MongoDB connected');
      return m;
    })
    .catch((err) => {
      connectPromise = null;
      logger.error({ err }, 'MongoDB connection failed');
      throw err;
    });

  return connectPromise;
}

async function disconnectMongo() {
  if (!isMongoReady()) return;
  await mongoose.disconnect();
}

module.exports = {
  mongoose,
  connectMongo,
  disconnectMongo,
  isMongoConfigured,
  isMongoReady,
};
