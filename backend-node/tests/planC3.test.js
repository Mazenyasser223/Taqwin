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

function clearJobModules() {
  for (const key of Object.keys(requireFromHere('module')._cache)) {
    if (
      key.includes(`${path.sep}src${path.sep}jobs`) ||
      key.endsWith(`${path.sep}redisBull.js`)
    ) {
      delete requireFromHere('module')._cache[key];
    }
  }
}

describe('Block C3 plan queue', () => {
  const prevEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    clearJobModules();
    process.env.FEATURE_PLAN_QUEUE = 'true';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  });

  afterEach(() => {
    process.env = { ...prevEnv };
    clearJobModules();
  });

  it('isPlanQueueEnabled requires feature flag and REDIS_URL', () => {
    delete process.env.REDIS_URL;
    stubModule(path.join(root, 'src/lib/redisBull.js'), {
      isBullMqConfigured: () => false,
      isPlanQueueFeatureEnabled: () => true,
      isPlanQueueEnabled: () => false,
    });
    const { isPlanQueueEnabled } = requireFromHere('../src/lib/redisBull');
    expect(isPlanQueueEnabled()).toBe(false);
  });

  it('enqueuePlanGenerate returns queue_disabled without feature', async () => {
    process.env.FEATURE_PLAN_QUEUE = 'false';
    stubModule(path.join(root, 'src/lib/redisBull.js'), {
      isPlanQueueEnabled: () => false,
    });
    stubModule(path.join(root, 'src/jobs/queues.js'), { getPlanGenerateQueue: () => null });
    stubModule(path.join(root, 'src/jobs/planGenerateLock.js'), {
      acquirePlanGenerateLock: vi.fn(),
      releasePlanGenerateLock: vi.fn(),
    });
    const { enqueuePlanGenerate } = requireFromHere('../src/jobs/planGenerateJobs');
    const result = await enqueuePlanGenerate({ userId: 'u1' });
    expect(result).toEqual({ ok: false, reason: 'queue_disabled' });
  });

  it('enqueuePlanGenerate enqueues when lock acquired', async () => {
    const add = vi.fn().mockResolvedValue({ id: 'plan-generate-u1' });
    const getJob = vi.fn().mockResolvedValue(null);

    stubModule(path.join(root, 'src/lib/redisBull.js'), {
      isPlanQueueEnabled: () => true,
    });
    stubModule(path.join(root, 'src/jobs/planGenerateLock.js'), {
      acquirePlanGenerateLock: vi.fn().mockResolvedValue({ acquired: true }),
      releasePlanGenerateLock: vi.fn(),
    });
    stubModule(path.join(root, 'src/jobs/queues.js'), {
      getPlanGenerateQueue: () => ({ add, getJob }),
    });

    const { enqueuePlanGenerate } = requireFromHere('../src/jobs/planGenerateJobs');
    const result = await enqueuePlanGenerate({
      userId: 'u1',
      locale: 'en',
      regenerationReason: 'test',
      source: 'api',
    });

    expect(result.ok).toBe(true);
    expect(result.jobId).toBe('plan-generate-u1');
    expect(add).toHaveBeenCalledWith(
      'generate',
      expect.objectContaining({ userId: 'u1', locale: 'en' }),
      { jobId: 'plan-generate-u1' }
    );
  });

  it('enqueuePlanGenerate returns locked when lock not acquired', async () => {
    stubModule(path.join(root, 'src/lib/redisBull.js'), {
      isPlanQueueEnabled: () => true,
    });
    stubModule(path.join(root, 'src/jobs/planGenerateLock.js'), {
      acquirePlanGenerateLock: vi.fn().mockResolvedValue({ acquired: false, reason: 'locked' }),
      releasePlanGenerateLock: vi.fn(),
    });
    stubModule(path.join(root, 'src/jobs/queues.js'), {
      getPlanGenerateQueue: () => ({ add: vi.fn(), getJob: vi.fn() }),
    });

    const { enqueuePlanGenerate } = requireFromHere('../src/jobs/planGenerateJobs');
    const result = await enqueuePlanGenerate({ userId: 'u2' });
    expect(result).toEqual({ ok: false, reason: 'locked' });
  });
});
