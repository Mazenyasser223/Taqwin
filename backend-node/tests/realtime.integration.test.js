/**
 * WebSocket integration — auth + ping over a real HTTP server.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';
import jwt from 'jsonwebtoken';

const requireFromHere = createRequire(import.meta.url);
const WebSocket = requireFromHere('ws');
const { attachWebSocketHub, shutdownWebSocketHub } = requireFromHere('../src/realtime/wsHub');
const { getWebSocketStats } = requireFromHere('../src/realtime/registry');

function waitForType(ws, type, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${type}`));
    }, timeoutMs);

    const onMessage = (raw) => {
      try {
        const env = JSON.parse(String(raw));
        if (env.type === type) {
          cleanup();
          resolve(env);
        }
      } catch {
        /* ignore */
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      ws.off('message', onMessage);
    };

    ws.on('message', onMessage);
  });
}

describe('websocket integration', () => {
  /** @type {import('node:http').Server | null} */
  let server = null;
  let port = 0;

  beforeEach(async () => {
    process.env.FEATURE_REALTIME_WS = 'true';
    server = http.createServer();
    attachWebSocketHub(server);
    await new Promise((resolve) => server.listen(0, resolve));
    port = server.address().port;
  });

  afterEach(async () => {
    await shutdownWebSocketHub();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      server = null;
    }
  });

  it('authenticates and responds to ping', async () => {
    const token = jwt.sign(
      { sub: 'user-ws-int', email: 'ws@test.com', role: 'user' },
      process.env.JWT_SECRET,
    );
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });

    ws.send(JSON.stringify({ type: 'auth', token }));
    const authOk = await waitForType(ws, 'auth.ok');
    expect(authOk.userId).toBe('user-ws-int');

    ws.send(JSON.stringify({ type: 'ping' }));
    const pong = await waitForType(ws, 'pong');
    expect(pong.type).toBe('pong');

    const stats = getWebSocketStats();
    expect(stats.connections).toBeGreaterThanOrEqual(1);
    expect(stats.onlineUsers).toBeGreaterThanOrEqual(1);

    ws.close();
  });

  it('rejects unauthenticated coach.send', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });

    ws.send(JSON.stringify({ type: 'coach.send', text: 'hello there' }));
    const err = await waitForType(ws, 'auth.error');
    expect(err.message).toMatch(/auth/i);
    ws.close();
  });
});
