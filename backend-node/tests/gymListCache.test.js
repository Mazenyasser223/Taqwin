import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getActiveGymList, invalidateGymListCache } = require('../src/lib/gymListCache');

describe('gymListCache.getActiveGymList', () => {
  it('dedupes concurrent fetches and serves cache until invalidated', async () => {
    invalidateGymListCache();
    const fetcher = vi.fn().mockResolvedValue([{ id: 'gym-1' }]);

    const [a, b] = await Promise.all([
      getActiveGymList(fetcher),
      getActiveGymList(fetcher),
    ]);

    expect(a).toEqual([{ id: 'gym-1' }]);
    expect(b).toEqual([{ id: 'gym-1' }]);
    expect(fetcher).toHaveBeenCalledTimes(1);

    await getActiveGymList(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);

    invalidateGymListCache();
    await getActiveGymList(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
