/**
 * Stream plain text as coach.token WS events (off-topic, confirm replies, etc.).
 */
const WebSocket = require('ws');
const { serverEnvelope } = require('./envelope');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {(ws: import('ws').WebSocket, envelope: object) => void} send
 * @param {import('ws').WebSocket} ws
 * @param {string} turnId
 * @param {string} text
 * @param {{ signal?: AbortSignal, chunkSize?: number, delayMs?: number }} [opts]
 */
async function streamTextAsCoachTokens(send, ws, turnId, text, opts = {}) {
  const chunkSize = opts.chunkSize ?? 48;
  const delayMs = opts.delayMs ?? 12;
  const signal = opts.signal;
  const content = String(text || '');
  if (!content || !ws || ws.readyState !== WebSocket.OPEN) return;

  for (let i = 0; i < content.length; i += chunkSize) {
    if (signal?.aborted) return;
    if (ws.readyState !== WebSocket.OPEN) return;
    send(ws, serverEnvelope('coach.token', { turnId, delta: content.slice(i, i + chunkSize) }));
    if (i + chunkSize < content.length && delayMs > 0) {
      await delay(delayMs);
    }
  }
}

/**
 * Batches rapid SSE token events before forwarding over WebSocket.
 */
function createCoachTokenCoalescer(send, ws, turnId, flushMs = 24) {
  let buffer = '';
  let timer = null;

  const flush = () => {
    timer = null;
    if (!buffer || ws.readyState !== WebSocket.OPEN) {
      buffer = '';
      return;
    }
    send(ws, serverEnvelope('coach.token', { turnId, delta: buffer }));
    buffer = '';
  };

  return {
    push(delta) {
      if (!delta) return;
      buffer += delta;
      if (!timer) {
        timer = setTimeout(flush, flushMs);
      }
    },
    flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      flush();
    },
    clear() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      buffer = '';
    },
  };
}

module.exports = { streamTextAsCoachTokens, createCoachTokenCoalescer };
