/**
 * Redis pub/sub bus for cross-process WebSocket delivery (TCP REDIS_URL only).
 */
const { logger } = require('../lib/logger');
const { pushToUserLocal } = require('./registry');

const REALTIME_CHANNEL = 'taqwin:realtime';

let publisher = null;
let subscriber = null;
let started = false;

function isRealtimeBusConfigured() {
  return Boolean(process.env.REDIS_URL?.trim());
}

async function startRealtimeBus() {
  if (started || !isRealtimeBusConfigured()) return false;
  try {
    const Redis = require('ioredis');
    const url = process.env.REDIS_URL.trim();
    const opts = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    };
    if (url.startsWith('rediss://')) opts.tls = {};

    publisher = new Redis(url, opts);
    subscriber = new Redis(url, opts);
    publisher.on('error', (err) => logger.warn({ err: err.message }, 'Realtime Redis publisher error'));
    subscriber.on('error', (err) => logger.warn({ err: err.message }, 'Realtime Redis subscriber error'));

    await publisher.connect();
    await subscriber.connect();
    await subscriber.subscribe(REALTIME_CHANNEL);
    subscriber.on('message', (channel, message) => {
      if (channel !== REALTIME_CHANNEL) return;
      try {
        const parsed = JSON.parse(message);
        const ids = Array.isArray(parsed.targetUserIds) ? parsed.targetUserIds : [];
        const envelope = parsed.envelope;
        if (!envelope || typeof envelope !== 'object') return;
        for (const uid of ids) {
          if (typeof uid === 'string' && uid) pushToUserLocal(uid, envelope);
        }
      } catch (err) {
        logger.warn({ err: err.message }, 'Realtime Redis message parse failed');
      }
    });

    started = true;
    logger.info('Realtime Redis pub/sub bus started');
    return true;
  } catch (err) {
    logger.warn({ err: err.message }, 'Realtime Redis bus unavailable — local WS only');
    publisher = null;
    subscriber = null;
    started = false;
    return false;
  }
}

async function stopRealtimeBus() {
  if (!started) return;
  try {
    if (subscriber) await subscriber.quit();
  } catch {
    /* ignore */
  }
  try {
    if (publisher) await publisher.quit();
  } catch {
    /* ignore */
  }
  publisher = null;
  subscriber = null;
  started = false;
}

/**
 * @param {string[]} userIds
 * @param {Record<string, unknown>} envelope
 */
async function publishToUsers(userIds, envelope) {
  const uniq = [...new Set((userIds || []).filter((id) => typeof id === 'string' && id))];
  if (!uniq.length || !envelope) return;

  if (started && publisher) {
    try {
      await publisher.publish(
        REALTIME_CHANNEL,
        JSON.stringify({ targetUserIds: uniq, envelope })
      );
      return;
    } catch (err) {
      logger.warn({ err: err.message }, 'Realtime Redis publish failed — falling back to local');
    }
  }

  for (const uid of uniq) {
    pushToUserLocal(uid, envelope);
  }
}

module.exports = {
  REALTIME_CHANNEL,
  isRealtimeBusConfigured,
  startRealtimeBus,
  stopRealtimeBus,
  publishToUsers,
};
