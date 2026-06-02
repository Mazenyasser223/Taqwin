import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  isFastApiBridgeEnabled,
  toFastApiMessages,
  chatViaFastApi,
} = requireFromHere('../src/services/aiFastApiClient');

describe('aiFastApiClient', () => {
  const envBackup = {
    FEATURE_AI_VIA_FASTAPI: process.env.FEATURE_AI_VIA_FASTAPI,
    AI_SERVICE_URL: process.env.AI_SERVICE_URL,
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    if (envBackup.FEATURE_AI_VIA_FASTAPI === undefined) {
      delete process.env.FEATURE_AI_VIA_FASTAPI;
    } else {
      process.env.FEATURE_AI_VIA_FASTAPI = envBackup.FEATURE_AI_VIA_FASTAPI;
    }
    if (envBackup.AI_SERVICE_URL === undefined) {
      delete process.env.AI_SERVICE_URL;
    } else {
      process.env.AI_SERVICE_URL = envBackup.AI_SERVICE_URL;
    }
  });

  beforeEach(() => {
    delete process.env.FEATURE_AI_VIA_FASTAPI;
    delete process.env.AI_SERVICE_URL;
  });

  it('isFastApiBridgeEnabled requires flag and URL', () => {
    expect(isFastApiBridgeEnabled()).toBe(false);
    process.env.FEATURE_AI_VIA_FASTAPI = 'true';
    expect(isFastApiBridgeEnabled()).toBe(false);
    process.env.AI_SERVICE_URL = 'http://localhost:8000';
    expect(isFastApiBridgeEnabled()).toBe(true);
    process.env.FEATURE_AI_VIA_FASTAPI = 'false';
    expect(isFastApiBridgeEnabled()).toBe(false);
  });

  it('toFastApiMessages maps model role to assistant', () => {
    expect(
      toFastApiMessages([
        { role: 'user', content: 'hi' },
        { role: 'model', content: 'hello' },
      ])
    ).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ]);
  });

  it('chatViaFastApi POSTs camelCase body to /chat', async () => {
    process.env.AI_SERVICE_URL = 'http://localhost:8000/';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reply: '[taqwin-ai stub] test',
        toolCalls: [],
        confirmationRequired: false,
        intent: 'general',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await chatViaFastApi({
      userId: 'user-1',
      threadId: 'thread-1',
      messages: [{ role: 'user', content: 'test' }],
      locale: 'ar',
      contextBundle: { locale: 'ar' },
    });

    expect(result.reply).toBe('[taqwin-ai stub] test');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:8000/chat');
    const body = JSON.parse(init.body);
    expect(body.userId).toBe('user-1');
    expect(body.threadId).toBe('thread-1');
    expect(body.locale).toBe('ar');
    expect(body.messages[0]).toEqual({ role: 'user', content: 'test' });
  });

  it('chatViaFastApi throws on non-OK response', async () => {
    process.env.AI_SERVICE_URL = 'http://localhost:8000';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'unavailable',
      })
    );

    await expect(
      chatViaFastApi({
        userId: 'u',
        messages: [{ role: 'user', content: 'x' }],
      })
    ).rejects.toThrow(/FastAPI chat 503/);
  });
});
