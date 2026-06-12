/**
 * Realtime unit tests — envelope parsing and registry.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { parseClientMessage, serverEnvelope } = requireFromHere('../src/realtime/envelope');
const {
  registerConnection,
  unregisterConnection,
  pushToUserLocal,
  getConnectionMeta,
} = requireFromHere('../src/realtime/registry');

describe('realtime envelope', () => {
  it('parses auth message', () => {
    const res = parseClientMessage(JSON.stringify({ type: 'auth', token: 'a'.repeat(20) }));
    expect(res.ok).toBe(true);
    expect(res.message?.type).toBe('auth');
  });

  it('rejects invalid coach.send', () => {
    const res = parseClientMessage(JSON.stringify({ type: 'coach.send', text: '' }));
    expect(res.ok).toBe(false);
  });

  it('builds server envelope with ts', () => {
    const env = serverEnvelope('pong');
    expect(env.type).toBe('pong');
    expect(typeof env.ts).toBe('number');
  });
});

describe('realtime registry', () => {
  /** @type {{ OPEN: number, readyState: number, send: (raw: string) => void, _sent: string[] }} */
  let ws;

  beforeEach(() => {
    const sent = [];
    ws = {
      OPEN: 1,
      readyState: 1,
      send: (raw) => sent.push(raw),
      _sent: sent,
    };
  });

  it('registers and pushes to user', () => {
    registerConnection('user-1', ws);
    expect(getConnectionMeta(ws)?.userId).toBe('user-1');
    const n = pushToUserLocal('user-1', { type: 'test', ok: true });
    expect(n).toBe(1);
    expect(JSON.parse(ws._sent[0]).type).toBe('test');
    unregisterConnection(ws);
    expect(pushToUserLocal('user-1', { type: 'x' })).toBe(0);
  });
});
