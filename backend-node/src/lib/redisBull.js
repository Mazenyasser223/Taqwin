/**
 * TCP Redis connection for BullMQ (Block C3).
 *
 * BullMQ requires ioredis with maxRetriesPerRequest: null.
 * Upstash REST (@upstash/redis) cannot run BullMQ — use REDIS_URL (TCP tab).
 */
const { logger } = require('./logger');

let bullConnection = null;

function isBullMqConfigured() {
  return Boolean(process.env.REDIS_URL?.trim());
}

function isPlanQueueFeatureEnabled() {
  const flag = (process.env.FEATURE_PLAN_QUEUE || '').toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'yes';
}

/** Queue + worker available when TCP Redis is set and feature flag is on. */
function isPlanQueueEnabled() {
  return isPlanQueueFeatureEnabled() && isBullMqConfigured();
}

function createBullConnection() {
  if (!isBullMqConfigured()) {
    throw new Error('REDIS_URL is required for BullMQ (TCP, not Upstash REST only)');
  }
  const Redis = require('ioredis');
  const url = process.env.REDIS_URL.trim();
  const opts = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 10000),
  };
  if (url.startsWith('rediss://')) {
    opts.tls = {};
  }
  return new Redis(url, opts);
}

/** Shared connection for Queue/Worker instances in one process. */
function getBullConnection() {
  if (!bullConnection) {
    bullConnection = createBullConnection();
    bullConnection.on('error', (err) => {
      logger.warn({ err: err.message }, 'BullMQ Redis connection error');
    });
  }
  return bullConnection;
}

async function closeBullConnection() {
  if (!bullConnection) return;
  try {
    await bullConnection.quit();
  } catch {
    try {
      bullConnection.disconnect();
    } catch {
      /* ignore */
    }
  }
  bullConnection = null;
}

module.exports = {
  isBullMqConfigured,
  isPlanQueueFeatureEnabled,
  isPlanQueueEnabled,
  createBullConnection,
  getBullConnection,
  closeBullConnection,
};
