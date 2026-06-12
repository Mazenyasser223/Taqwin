/**
 * Coach chat streaming via FastAPI SSE → Node event callbacks.
 */
const { getServiceBaseUrl, getTimeoutMs, toFastApiMessages } = require('./aiFastApiClient');

/**
 * @param {object} opts - same shape as chatViaFastApi
 * @param {(event: { event: string, data: Record<string, unknown> }) => void} onEvent
 * @param {AbortSignal} [signal]
 */
async function chatStreamViaFastApi(opts, onEvent, signal) {
  const base = getServiceBaseUrl();
  if (!base) {
    throw new Error('AI_SERVICE_URL is not configured');
  }

  const body = {
    userId: opts.userId,
    threadId: opts.threadId || null,
    messages: toFastApiMessages(opts.messages),
    locale: opts.locale || 'en',
    contextBundle: opts.contextBundle ?? null,
    pendingAction: opts.pendingAction ?? null,
  };

  const timeoutMs = getTimeoutMs() * 3;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(`${base}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`FastAPI chat/stream ${res.status}: ${text.slice(0, 300)}`);
    }

    if (!res.body) {
      throw new Error('FastAPI chat/stream returned empty body');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        const lines = part.split('\n');
        let event = 'message';
        let dataStr = '';
        for (const line of lines) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
        }
        if (!dataStr) continue;
        let data;
        try {
          data = JSON.parse(dataStr);
        } catch {
          data = { raw: dataStr };
        }
        onEvent({ event, data });
      }
    }
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { chatStreamViaFastApi };
