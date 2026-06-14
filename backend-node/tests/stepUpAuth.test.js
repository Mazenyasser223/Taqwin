import { describe, it, expect, afterEach } from 'vitest';

import { createRequire } from 'node:module';



const requireFromHere = createRequire(import.meta.url);

const bcrypt = requireFromHere('bcryptjs');

const { prisma } = requireFromHere('../src/db');

const {

  STEP_UP_TOOLS,

  pendingRequiresStepUp,

  phrasesMatch,

  resolveStepUpPhrase,

  buildStepUpMeta,

  verifyStepUpAuth,

  isPendingStale,

  resolveStepUpState,

  STEP_UP_IDLE_MS,

  STEP_UP_MAX_FAILS,

  STEP_UP_LOCKOUT_MS,

} = requireFromHere('../src/lib/coach/stepUpAuth');



const originalFindUnique = prisma.user.findUnique;



function freshPending(overrides = {}) {

  return {

    actionId: 'action-1',

    tools: ['adapt_plan'],

    locale: 'en',

    stepUpEligible: true,

    stepUpPhrase: 'ADAPT',

    stepUpMethods: ['phrase'],

    createdAt: new Date().toISOString(),

    ...overrides,

  };

}



function stalePending(overrides = {}) {

  return freshPending({

    createdAt: new Date(Date.now() - STEP_UP_IDLE_MS - 1000).toISOString(),

    ...overrides,

  });

}



describe('stepUpAuth', () => {

  afterEach(() => {

    prisma.user.findUnique = originalFindUnique;

  });



  it('flags expanded high-impact tools', () => {

    expect(pendingRequiresStepUp(['set_life_mode'])).toBe(true);

    expect(pendingRequiresStepUp(['adapt_plan'])).toBe(true);

    expect(pendingRequiresStepUp(['update_fitness_goal'])).toBe(true);

    expect(pendingRequiresStepUp(['generate_weekly_workout'])).toBe(true);

    expect(pendingRequiresStepUp(['log_food'])).toBe(false);

    expect(STEP_UP_TOOLS.has('replace_exercise_today')).toBe(true);

  });



  it('uses life mode as context-aware phrase', () => {

    expect(

      resolveStepUpPhrase(['set_life_mode'], { set_life_mode: { lifeMode: 'travel' } }, 'en'),

    ).toBe('TRAVEL');

  });



  it('matches ADAPT phrase case-insensitively', () => {

    expect(phrasesMatch('adapt', 'ADAPT')).toBe(true);

    expect(phrasesMatch('wrong', 'ADAPT')).toBe(false);

  });



  it('builds step-up meta as eligible but not required when fresh', async () => {

    prisma.user.findUnique = async () => ({ id: 'user-1', passwordHash: 'hash' });

    const meta = await buildStepUpMeta('user-1', ['adapt_plan'], 'en');

    expect(meta.stepUpEligible).toBe(true);

    expect(meta.requiresStepUp).toBe(false);

    expect(meta.stepUpPhrase).toBe('ADAPT');

    expect(meta.stepUpMethods).toEqual(['phrase', 'password']);

  });



  it('resolveStepUpState requires proof only when stale', () => {

    const fresh = resolveStepUpState(freshPending());

    expect(fresh.stepUpEligible).toBe(true);

    expect(fresh.stepUpRequired).toBe(false);



    const stale = resolveStepUpState(stalePending());

    expect(stale.stepUpRequired).toBe(true);

    expect(isPendingStale(stalePending())).toBe(true);

  });



  it('accepts confirm on fresh pending without proof', async () => {

    const result = await verifyStepUpAuth({

      userId: 'user-1',

      pending: freshPending(),

    });

    expect(result.ok).toBe(true);

  });



  it('rejects stale confirm without step-up proof', async () => {

    const result = await verifyStepUpAuth({

      userId: 'user-1',

      pending: stalePending(),

    });

    expect(result.ok).toBe(false);

    expect(result.status).toBe(403);

    expect(result.code).toBe('STEP_UP_REQUIRED');

  });



  it('accepts valid confirmation phrase on stale pending', async () => {

    const result = await verifyStepUpAuth({

      userId: 'user-1',

      pending: stalePending(),

      confirmationPhrase: 'adapt',

    });

    expect(result.ok).toBe(true);

  });



  it('accepts password re-auth when hash matches', async () => {

    const hash = await bcrypt.hash('secret-pass', 4);

    prisma.user.findUnique = async () => ({ id: 'user-1', passwordHash: hash });

    const result = await verifyStepUpAuth({

      userId: 'user-1',

      pending: stalePending(),

      password: 'secret-pass',

    });

    expect(result.ok).toBe(true);

  });



  it('locks out after repeated failures', async () => {

    const pending = stalePending({ actionId: 'lock-action' });

    for (let i = 0; i < 5; i += 1) {

      await verifyStepUpAuth({ userId: 'user-lock', pending, confirmationPhrase: 'wrong' });

    }

    const locked = await verifyStepUpAuth({ userId: 'user-lock', pending, confirmationPhrase: 'ADAPT' });

    expect(locked.ok).toBe(false);

    expect(locked.status).toBe(429);

    expect(locked.code).toBe('STEP_UP_LOCKOUT');

  });

  it('exposes env-backed defaults for overrides', () => {
    expect(STEP_UP_IDLE_MS).toBeGreaterThanOrEqual(60_000);
    expect(STEP_UP_MAX_FAILS).toBeGreaterThanOrEqual(1);
    expect(STEP_UP_LOCKOUT_MS).toBeGreaterThanOrEqual(60_000);
  });

});

