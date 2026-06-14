/**
 * In-memory WebSocket connection registry (userId → Set<WebSocket>).
 */

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const byUser = new Map();

/** @type {WeakMap<import('ws').WebSocket, { userId: string, authenticated: boolean }>} */
const meta = new WeakMap();

function registerConnection(userId, ws) {
  if (!userId || !ws) return;
  let set = byUser.get(userId);
  if (!set) {
    set = new Set();
    byUser.set(userId, set);
  }
  set.add(ws);
  meta.set(ws, { userId, authenticated: true });
}

function unregisterConnection(ws) {
  const m = meta.get(ws);
  if (!m?.userId) return;
  const set = byUser.get(m.userId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) byUser.delete(m.userId);
  }
  meta.delete(ws);
}

function getConnectionMeta(ws) {
  return meta.get(ws) || null;
}

function setConnectionMeta(ws, patch) {
  const prev = meta.get(ws) || { userId: '', authenticated: false };
  meta.set(ws, { ...prev, ...patch });
}

function pushToUserLocal(userId, envelope) {
  const set = byUser.get(userId);
  if (!set?.size) return 0;
  const raw = JSON.stringify(envelope);
  let sent = 0;
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) {
      ws.send(raw);
      sent += 1;
    }
  }
  return sent;
}

function onlineUserIds() {
  return [...byUser.keys()];
}

function connectionCountForUser(userId) {
  return byUser.get(userId)?.size || 0;
}

function getWebSocketStats() {
  let connections = 0;
  for (const set of byUser.values()) connections += set.size;
  return {
    enabled: true,
    onlineUsers: byUser.size,
    connections,
  };
}

module.exports = {
  registerConnection,
  unregisterConnection,
  getConnectionMeta,
  setConnectionMeta,
  pushToUserLocal,
  onlineUserIds,
  connectionCountForUser,
  getWebSocketStats,
};
