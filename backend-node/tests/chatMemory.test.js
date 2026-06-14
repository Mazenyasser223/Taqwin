import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  loadRecentMessages,
  resolveHistory,
  chatCtxKey,
  REDIS_MESSAGE_CAP,
} = requireFromHere('../src/lib/chatMemory');

describe('chatMemory (Block A5)', () => {
  it('chatCtxKey uses thread id', () => {
    expect(chatCtxKey('thread-abc')).toBe('chat:ctx:thread-abc');
  });

  it('loadRecentMessages returns empty without threadId', async () => {
    expect(await loadRecentMessages('user-1', null)).toEqual([]);
    expect(await loadRecentMessages('user-1', '')).toEqual([]);
  });

  it('resolveHistory returns empty when mongo is not configured', async () => {
    const result = await resolveHistory({
      userId: 'user-1',
      conversationId: '507f1f77bcf86cd799439011',
      locale: 'ar',
    });
    expect(result.historyMessages).toEqual([]);
    expect(result.conversation).toBeNull();
  });

  it('exports redis message cap constant', () => {
    expect(REDIS_MESSAGE_CAP).toBe(20);
  });
});
