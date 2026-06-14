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
const dns = require('dns');
const { logger } = require('../../lib/logger');

// Windows/Node: SRV DNS (mongodb+srv) often fails with querySrv ECONNREFUSED; prefer standard URI in .env.
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

let connectPromise = null;
let warnedMissing = false;
let indexesSynced = false;

function getMongoUri() {
  return process.env.MONGO_URI || process.env.MONGODB_URI || '';
}

/**
 * Database name for mongoose. URI path is unreliable when the password contains
 * `@` (even when percent-encoded) — the driver may default to `test`.
 */
function getMongoDbName() {
  const explicit = process.env.MONGO_DB_NAME?.trim();
  if (explicit) return explicit;

  const uri = getMongoUri();
  if (!uri) return 'taqwin';

  const atlasPath = uri.match(/\.mongodb\.net\/([^/?]+)/i);
  if (atlasPath?.[1]) return atlasPath[1];

  const genericPath = uri.match(/mongodb(?:\+srv)?:\/\/[^/]+\/([^/?]+)/i);
  if (genericPath?.[1]) return genericPath[1];

  return 'taqwin';
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

  const { ensureMongoIndexes } = require('./ensureIndexes');

  const dbName = getMongoDbName();

  connectPromise = mongoose
    .connect(getMongoUri(), {
      dbName,
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
    })
    .then(async (m) => {
      logger.info({ host: mongoose.connection.host, db: mongoose.connection.name }, 'MongoDB connected');
      if (!indexesSynced) {
        indexesSynced = true;
        try {
          await ensureMongoIndexes();
        } catch (err) {
          logger.warn({ err: err.message }, 'MongoDB index sync failed — queries may be slow');
        }
      }
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
  getMongoDbName,
};
