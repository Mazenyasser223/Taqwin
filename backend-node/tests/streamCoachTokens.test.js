import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { createCoachTokenCoalescer } = requireFromHere('../src/realtime/streamCoachTokens');

describe('createCoachTokenCoalescer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('batches token deltas before flushing', () => {
    const sent = [];
    const ws = { readyState: WebSocket.OPEN };
    const send = (_ws, envelope) => sent.push(envelope);

    const coalescer = createCoachTokenCoalescer(send, ws, 'turn-1', 24);
    coalescer.push('Hel');
    coalescer.push('lo');
    expect(sent).toHaveLength(0);

    vi.advanceTimersByTime(24);
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('coach.token');
    expect(sent[0].delta).toBe('Hello');
  });

  it('flush() emits any pending buffer immediately', () => {
    const sent = [];
    const ws = { readyState: WebSocket.OPEN };
    const send = (_ws, envelope) => sent.push(envelope);

    const coalescer = createCoachTokenCoalescer(send, ws, 'turn-2', 24);
    coalescer.push('Hi');
    coalescer.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].delta).toBe('Hi');
  });
});
