import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const root = path.resolve(__dirname, '..');

function stubModule(absPath, exports) {
  requireFromHere('module')._cache[absPath] = {
    id: absPath,
    filename: absPath,
    loaded: true,
    exports,
    children: [],
    paths: requireFromHere('module')._nodeModulePaths(path.dirname(absPath)),
  };
}

function clearMemoryTriggerModules() {
  for (const key of Object.keys(requireFromHere('module')._cache)) {
    if (
      key.includes(`${path.sep}memorySessionTrigger.js`) ||
      key.includes(`${path.sep}memoryEvents.js`) ||
      key.includes(`${path.sep}aiMemoryJobs.js`) ||
      key.includes(`${path.sep}mongo${path.sep}client.js`) ||
      key.includes(`${path.sep}message.js`)
    ) {
      delete requireFromHere('module')._cache[key];
    }
  }
}

describe('memorySessionTrigger', () => {
  const prevEnv = { ...process.env };
  const mockCountDocuments = vi.fn();
  const mockConnectMongo = vi.fn().mockResolvedValue(undefined);
  const mockRedisGetJson = vi.fn().mockResolvedValue(null);
  const mockRedisSetJson = vi.fn().mockResolvedValue(true);
  const mockEnqueue = vi.fn().mockResolvedValue({ ok: true, jobId: 'job-1' });

  beforeEach(() => {
    vi.clearAllMocks();
    clearMemoryTriggerModules();
    delete process.env.FEATURE_AI_MEMORY_SESSION;
    mockCountDocuments.mockResolvedValue(0);
    mockRedisGetJson.mockResolvedValue(null);
    mockEnqueue.mockResolvedValue({ ok: true, jobId: 'job-1' });

    stubModule(path.join(root, 'src/db/mongo/client.js'), {
      isMongoConfigured: () => true,
      connectMongo: mockConnectMongo,
    });
    stubModule(path.join(root, 'src/db/mongo/models/message.js'), {
      countDocuments: mockCountDocuments,
    });
    stubModule(path.join(root, 'src/lib/redis.js'), {
      redisGetJson: mockRedisGetJson,
      redisSetJson: mockRedisSetJson,
    });
    stubModule(path.join(root, 'src/lib/redisBull.js'), {
      isPlanQueueEnabled: () => true,
    });
    stubModule(path.join(root, 'src/jobs/aiMemoryJobs.js'), {
      enqueueAiMemorySummarize: mockEnqueue,
    });
  });

  afterEach(() => {
    process.env = { ...prevEnv };
    clearMemoryTriggerModules();
  });

  function loadTrigger() {
    return requireFromHere('../src/lib/ai/memorySessionTrigger');
  }

  it('skips when queue disabled', async () => {
    stubModule(path.join(root, 'src/lib/redisBull.js'), {
      isPlanQueueEnabled: () => false,
    });
    clearMemoryTriggerModules();
    const { maybeEnqueueMemoryAfterSession } = loadTrigger();
    const result = await maybeEnqueueMemoryAfterSession({
      userId: 'u1',
      conversationId: '507f1f77bcf86cd799439011',
    });
    expect(result.reason).toBe('queue_disabled');
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('skips when mongo not configured', async () => {
    stubModule(path.join(root, 'src/db/mongo/client.js'), {
      isMongoConfigured: () => false,
      connectMongo: mockConnectMongo,
    });
    clearMemoryTriggerModules();
    const { maybeEnqueueMemoryAfterSession } = loadTrigger();
    const result = await maybeEnqueueMemoryAfterSession({
      userId: 'u1',
      conversationId: '507f1f77bcf86cd799439011',
    });
    expect(result.reason).toBe('mongo_unconfigured');
  });

  it('skips below threshold', async () => {
    mockCountDocuments.mockResolvedValue(3);
    const { maybeEnqueueMemoryAfterSession } = loadTrigger();
    const result = await maybeEnqueueMemoryAfterSession({
      userId: 'u1',
      conversationId: '507f1f77bcf86cd799439011',
    });
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('below_threshold');
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('enqueues at 5 user turns with session_chat source', async () => {
    mockCountDocuments.mockResolvedValue(5);
    const convId = '507f1f77bcf86cd799439011';
    const { maybeEnqueueMemoryAfterSession } = loadTrigger();
    const result = await maybeEnqueueMemoryAfterSession({
      userId: 'u1',
      conversationId: convId,
      locale: 'en',
    });
    expect(result.ok).toBe(true);
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        locale: 'en',
        hours: 24,
        source: 'session_chat',
      })
    );
    expect(mockRedisSetJson).toHaveBeenCalledWith(
      `ai-memory-milestone:${convId}`,
      expect.objectContaining({ milestone: 5 }),
      expect.any(Number)
    );
  });

  it('skips off-topic turns', async () => {
    mockCountDocuments.mockResolvedValue(10);
    const { maybeEnqueueMemoryAfterSession } = loadTrigger();
    const result = await maybeEnqueueMemoryAfterSession({
      userId: 'u1',
      conversationId: '507f1f77bcf86cd799439011',
      meta: { offTopic: true },
    });
    expect(result.reason).toBe('off_topic');
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('dedupes same milestone via redis', async () => {
    mockCountDocuments.mockResolvedValue(7);
    mockRedisGetJson.mockResolvedValue({ milestone: 5 });
    const { maybeEnqueueMemoryAfterSession } = loadTrigger();
    const result = await maybeEnqueueMemoryAfterSession({
      userId: 'u1',
      conversationId: '507f1f77bcf86cd799439011',
    });
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('milestone_done');
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('re-enqueues at next milestone (10 turns)', async () => {
    mockCountDocuments.mockResolvedValue(10);
    mockRedisGetJson.mockResolvedValue({ milestone: 5 });
    const { maybeEnqueueMemoryAfterSession } = loadTrigger();
    const result = await maybeEnqueueMemoryAfterSession({
      userId: 'u1',
      conversationId: '507f1f77bcf86cd799439011',
    });
    expect(result.ok).toBe(true);
    expect(result.milestone).toBe(10);
    expect(mockEnqueue).toHaveBeenCalled();
  });
});
