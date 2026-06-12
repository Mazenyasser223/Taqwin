#!/usr/bin/env node
/**
 * Coach streaming readiness — WebSocket hub + FastAPI SSE chain.
 *
 *   npm run verify:ws-streaming
 *   npm run verify:ws-streaming -- --live
 *   API_URL=http://localhost:4000 npm run verify:ws-streaming -- --live
 */
/* eslint-disable no-console */
require('dotenv').config({ override: true });

const http = require('node:http');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');

const LIVE = process.argv.includes('--live');
const API_URL = (process.env.API_URL || process.env.BACKEND_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');

function ok(m) {
  console.log(`✓ ${m}`);
  return true;
}
function fail(m) {
  console.error(`✗ ${m}`);
  return false;
}
function warn(m) {
  console.warn(`⚠ ${m}`);
  return false;
}

function wsUrlFromApi(base) {
  return base.replace(/^http/i, 'ws') + '/ws';
}

function waitForType(ws, type, timeoutMs = 8000) {
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

async function probeLocalHub() {
  const { isRealtimeEnabled } = require('../src/realtime/wsHub');
  const { attachWebSocketHub, shutdownWebSocketHub } = require('../src/realtime/wsHub');

  if (!process.env.JWT_SECRET?.trim()) {
    return fail('JWT_SECRET required for WS auth probe');
  }

  const server = http.createServer();
  attachWebSocketHub(server);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const token = jwt.sign(
      { sub: 'verify-ws-stream', email: 'verify@taqwin.test', role: 'user' },
      process.env.JWT_SECRET,
    );
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });
    ws.send(JSON.stringify({ type: 'auth', token }));
    const authOk = await waitForType(ws, 'auth.ok');
    if (!authOk.userId) return fail('auth.ok missing userId');

    ws.send(JSON.stringify({ type: 'ping' }));
    await waitForType(ws, 'pong');
    ws.close();
    ok('embedded WS hub: auth + ping/pong');
    return true;
  } finally {
    await shutdownWebSocketHub();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function probeRemoteHealth() {
  const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return fail(`${API_URL}/health → HTTP ${res.status}`);
  const body = await res.json().catch(() => ({}));
  ok(`${API_URL}/health → ${body.status || 'unknown'}`);
  if (body.websocket) {
    console.log('    websocket:', JSON.stringify(body.websocket));
    if (body.websocket.enabled === false) warn('health reports websocket.enabled=false');
    else ok('health includes websocket stats');
  } else {
    warn('health response has no websocket block');
  }
  return true;
}

async function probeRemoteWs() {
  if (!process.env.JWT_SECRET?.trim()) {
    return fail('JWT_SECRET required for remote WS probe (sign test token)');
  }

  const token = jwt.sign(
    { sub: 'verify-ws-stream', email: 'verify@taqwin.test', role: 'user' },
    process.env.JWT_SECRET,
  );
  const ws = new WebSocket(wsUrlFromApi(API_URL));
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  ws.send(JSON.stringify({ type: 'auth', token }));
  const authOk = await waitForType(ws, 'auth.ok');
  if (!authOk.userId) return fail('remote auth.ok missing userId');
  ws.send(JSON.stringify({ type: 'ping' }));
  await waitForType(ws, 'pong');
  ws.close();
  ok(`remote WS ${wsUrlFromApi(API_URL)}: auth + ping/pong`);
  return true;
}

async function probeLiveCoachStream() {
  if (!process.env.JWT_SECRET?.trim()) {
    return fail('JWT_SECRET required for live coach.send probe');
  }
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    warn('ANTHROPIC_API_KEY not set — skipping live coach.token probe');
    return true;
  }

  const token = jwt.sign(
    { sub: 'verify-ws-stream', email: 'verify@taqwin.test', role: 'user' },
    process.env.JWT_SECRET,
  );
  const ws = new WebSocket(wsUrlFromApi(API_URL));
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

  ws.send(JSON.stringify({ type: 'auth', token }));
  const authOk = await waitForType(ws, 'auth.ok', 10_000);
  if (!authOk.userId) {
    ws.close();
    return fail('live coach.send probe: auth.ok missing userId');
  }

  const turnId = `verify-${Date.now()}`;
  const streamResult = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, reason: 'timeout' }), 90_000);
    let tokens = 0;

    const onMessage = (raw) => {
      try {
        const env = JSON.parse(String(raw));
        if (env.turnId && env.turnId !== turnId) return;
        if (env.type === 'coach.token') tokens += 1;
        if (env.type === 'coach.done' || env.type === 'coach.error') {
          clearTimeout(timer);
          ws.off('message', onMessage);
          resolve({
            ok: env.type === 'coach.done',
            tokens,
            endType: env.type,
            message: env.message,
          });
        }
      } catch {
        /* ignore */
      }
    };

    ws.on('message', onMessage);
    ws.send(
      JSON.stringify({
        type: 'coach.send',
        turnId,
        text: 'Say hello in one short sentence.',
        locale: 'en',
      }),
    );
  });

  ws.close();

  if (!streamResult.ok) {
    return fail(
      `live coach.send → ${streamResult.endType || streamResult.reason}: ${streamResult.message || ''}`,
    );
  }
  if (streamResult.tokens < 1) {
    return fail('live coach.send completed but no coach.token events received');
  }
  ok(`live coach.send: ${streamResult.tokens} token event(s) → ${streamResult.endType}`);
  return true;
}

async function main() {
  let passed = true;
  console.log('── Coach streaming / WebSocket checklist ──\n');

  const { isRealtimeEnabled } = require('../src/realtime/wsHub');
  const { isFastApiBridgeEnabled } = require('../src/services/aiFastApiClient');

  if (isRealtimeEnabled()) ok('FEATURE_REALTIME_WS enabled');
  else passed = fail('FEATURE_REALTIME_WS must not be false/0 for coach streaming') && passed;

  if (isFastApiBridgeEnabled()) ok('FEATURE_AI_VIA_FASTAPI + AI_SERVICE_URL configured');
  else passed = fail('AI_SERVICE_URL + FEATURE_AI_VIA_FASTAPI required for coach SSE bridge') && passed;

  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    warn('ANTHROPIC_API_KEY not set — live token streaming will not work');
  } else {
    ok('ANTHROPIC_API_KEY set');
  }

  if (!process.env.JWT_SECRET?.trim()) {
    passed = fail('JWT_SECRET required for /ws auth') && passed;
  } else {
    ok('JWT_SECRET set');
  }

  console.log('\nEmbedded hub probe:');
  if (!(await probeLocalHub())) passed = false;

  if (LIVE) {
    console.log('\nRemote probes:');
    if (!(await probeRemoteHealth())) passed = false;
    if (!(await probeRemoteWs())) passed = false;
    console.log('\nLive coach stream probe:');
    if (!(await probeLiveCoachStream())) passed = false;
  } else {
    console.log('\nTip: run with --live and API_URL to probe a running backend');
  }

  console.log(passed ? '\n✓ Coach streaming checklist passed' : '\n✗ Coach streaming checklist failed');
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
