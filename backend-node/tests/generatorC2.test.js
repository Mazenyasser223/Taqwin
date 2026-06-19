import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

function clearGeneratorChain() {
  for (const key of Object.keys(requireFromHere('module')._cache)) {
    if (
      key.includes(`${path.sep}src${path.sep}lib${path.sep}plans${path.sep}`) &&
      (key.endsWith('generator.js') ||
        key.endsWith('persistPostgres.js') ||
        key.endsWith('planGenerationLog.js'))
    ) {
      delete requireFromHere('module')._cache[key];
    }
  }
}

describe('Block C2 saveGeneratedPlan', () => {
  const persistMock = vi.fn();
  const logMock = vi.fn().mockResolvedValue(undefined);
  let saveGeneratedPlan;

  beforeEach(() => {
    vi.clearAllMocks();
    clearGeneratorChain();

    persistMock.mockResolvedValue({
      _id: 'pg-1',
      userId: 'u1',
      version: 2,
      source: 'ai',
      dailyTargets: { calories: 2000, protein: 140, carbs: 200, fat: 60, waterMl: 2500 },
      dietDays: [],
      workoutWeeks: [],
      postgres: { workoutPlanId: 'w1', dietPlanId: 'd1' },
    });

    stubModule(path.join(root, 'src/lib/plans/persistPostgres.js'), {
      persistPlanToPostgres: persistMock,
      fetchActivePlanFromPostgres: vi.fn(),
    });
    stubModule(path.join(root, 'src/lib/plans/planGenerationLog.js'), {
      logPlanGeneration: logMock,
    });

    ({ saveGeneratedPlan } = requireFromHere('../src/lib/plans/generator'));
  });

  it('persists to Postgres only and logs acceptance', async () => {
    const saved = await saveGeneratedPlan({
      userId: 'u1',
      planData: {
        dailyTargets: { calories: 2000, protein: 140, carbs: 200, fat: 60, waterMl: 2500 },
        dietDays: [
          {
            dayIndex: 1,
            meals: [
              {
                slot: 'breakfast',
                items: [{ name: 'X', grams: 100, protein: 10, calories: 100, carbs: 10, fat: 2 }],
              },
            ],
          },
        ],
        workoutWeeks: [{ weekIndex: 1, days: [{ dayIndex: 1, isRest: true, exercises: [] }] }],
      },
      legacySource: 'ai',
      locale: 'en',
      explainabilityText: 'Because your goal is muscle gain.',
      fastApiSource: 'scaffold',
      inputSnapshot: { viaFastApi: true },
    });

    expect(persistMock).toHaveBeenCalledOnce();
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        validationResult: 'accepted',
        userId: 'u1',
        inputSnapshot: { viaFastApi: true },
      })
    );
    expect(saved.postgres.workoutPlanId).toBe('w1');
  });

  it('throws when Postgres persist fails (no Mongo fallback)', async () => {
    persistMock.mockRejectedValueOnce(new Error('db down'));

    await expect(
      saveGeneratedPlan({
        userId: 'u2',
        planData: {
          dailyTargets: { calories: 2000, protein: 140, carbs: 200, fat: 60, waterMl: 2500 },
          dietDays: [],
          workoutWeeks: [{ weekIndex: 1, days: [] }],
        },
        legacySource: 'fallback',
        locale: 'ar',
      })
    ).rejects.toThrow('db down');
  });
});
