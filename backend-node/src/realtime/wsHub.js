/**
 * WebSocket hub — auth, heartbeat, message dispatch.
 */
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { logger } = require('../lib/logger');
const {
  registerConnection,
  unregisterConnection,
  getConnectionMeta,
  setConnectionMeta,
} = require('./registry');
const { startRealtimeBus, stopRealtimeBus } = require('./redisBus');
const { parseClientMessage, serverEnvelope } = require('./envelope');
const { checkCoachSendRate } = require('./rateLimit');
const { handleCoachSend, handleCoachCancel } = require('./handlers/coach');
const {
  handleCoachConfirm,
  handleCoachCancelPending,
  handleCoachDisambiguate,
} = require('./handlers/coachActions');
const { handlePresencePing } = require('./handlers/presence');

const WS_PATH = '/ws';
const PING_INTERVAL_MS = 25_000;
const STALE_MS = 65_000;

/** @type {WebSocketServer | null} */
let wss = null;

function isRealtimeEnabled() {
  const flag = (process.env.FEATURE_REALTIME_WS || 'true').toLowerCase();
  return flag !== 'false' && flag !== '0';
}

function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret || !token) return null;
  try {
    const payload = jwt.verify(token, secret);
    return { id: payload.sub, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

function sendJson(ws, envelope) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(envelope));
}

function attachWebSocketHub(httpServer) {
  if (!isRealtimeEnabled()) {
    logger.info('WebSocket hub disabled (FEATURE_REALTIME_WS=false)');
    return null;
  }

  void startRealtimeBus();

  wss = new WebSocketServer({ server: httpServer, path: WS_PATH });

  wss.on('connection', (ws, req) => {
    setConnectionMeta(ws, { userId: '', authenticated: false });
    ws.isAlive = true;
    ws.lastPongAt = Date.now();

    const qToken =
      typeof req.url === 'string' && req.url.includes('token=')
        ? new URL(req.url, 'http://localhost').searchParams.get('token')
        : null;

    if (qToken) {
      const user = verifyToken(qToken);
      if (user?.id) {
        registerConnection(user.id, ws);
        sendJson(ws, serverEnvelope('auth.ok', { userId: user.id }));
      }
    }

    ws.on('pong', () => {
      ws.isAlive = true;
      ws.lastPongAt = Date.now();
    });

    ws.on('message', (raw) => {
      const text = typeof raw === 'string' ? raw : raw.toString('utf8');
      const parsed = parseClientMessage(text);
      if (!parsed.ok) {
        sendJson(ws, serverEnvelope('error', { message: parsed.error }));
        return;
      }

      const msg = parsed.message;

      if (msg.type === 'auth') {
        const user = verifyToken(msg.token);
        if (!user?.id) {
          sendJson(ws, serverEnvelope('auth.error', { message: 'Invalid or expired token' }));
          return;
        }
        registerConnection(user.id, ws);
        sendJson(ws, serverEnvelope('auth.ok', { userId: user.id }));
        return;
      }

      const meta = getConnectionMeta(ws);
      if (!meta?.authenticated || !meta.userId) {
        sendJson(ws, serverEnvelope('auth.error', { message: 'Authentication required' }));
        return;
      }

      if (msg.type === 'ping') {
        sendJson(ws, serverEnvelope('pong'));
        return;
      }

      if (msg.type === 'coach.send') {
        const rate = checkCoachSendRate(meta.userId);
        if (!rate.allowed) {
          sendJson(
            ws,
            serverEnvelope('coach.error', {
              message: 'Rate limit exceeded. Slow down.',
              retryAfterMs: rate.retryAfterMs,
            })
          );
          return;
        }
        void handleCoachSend(ws, meta.userId, msg);
        return;
      }

      if (msg.type === 'coach.cancel') {
        handleCoachCancel(ws, meta.userId, msg);
        return;
      }

      if (msg.type === 'coach.confirm') {
        void handleCoachConfirm(ws, meta.userId, msg);
        return;
      }

      if (msg.type === 'coach.cancelPending') {
        void handleCoachCancelPending(ws, meta.userId, msg);
        return;
      }

      if (msg.type === 'coach.disambiguate') {
        void handleCoachDisambiguate(ws, meta.userId, msg);
        return;
      }

      if (msg.type === 'presence.ping') {
        void handlePresencePing(ws, meta.userId);
      }
    });

    ws.on('close', () => unregisterConnection(ws));
    ws.on('error', (err) => {
      logger.debug({ err: err.message }, 'WebSocket client error');
      unregisterConnection(ws);
    });
  });

  const heartbeat = setInterval(() => {
    if (!wss) return;
    const now = Date.now();
    for (const client of wss.clients) {
      if (now - (client.lastPongAt || 0) > STALE_MS) {
        client.terminate();
        continue;
      }
      if (client.isAlive === false) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, PING_INTERVAL_MS);

  wss.on('close', () => clearInterval(heartbeat));

  logger.info({ path: WS_PATH }, 'WebSocket hub attached');
  return wss;
}

async function shutdownWebSocketHub() {
  if (wss) {
    for (const client of wss.clients) {
      client.close(1001, 'Server shutting down');
    }
    await new Promise((resolve) => wss.close(() => resolve()));
    wss = null;
  }
  await stopRealtimeBus();
}

module.exports = {
  WS_PATH,
  isRealtimeEnabled,
  attachWebSocketHub,
  shutdownWebSocketHub,
  verifyToken,
  getWebSocketServer: () => wss,
};
