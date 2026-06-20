import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  planStructureEditBlockedMessage,
  isAgentLockedPlan,
} = requireFromHere('../src/lib/plans/planEditPolicy');
const { getActiveOfficialPlanContext } = requireFromHere('../src/lib/plans/planEditPolicy');
const { prisma } = requireFromHere('./mocks/db.cjs');

describe('planEditPolicy messages', () => {
  it('returns localized blocked messages', () => {
    expect(planStructureEditBlockedMessage('en')).toMatch(/AI Coach/i);
    expect(planStructureEditBlockedMessage('ar')).toMatch(/المدرب/);
  });

  it('treats manual plans as editable and AI/onboarding plans as agent-only', () => {
    expect(isAgentLockedPlan({ source: 'manual' })).toBe(false);
    expect(isAgentLockedPlan({ source: 'ai' })).toBe(true);
    expect(isAgentLockedPlan({ source: 'onboarding' })).toBe(true);
  });

  it('allows structure edits when only a manual workout shell is active', async () => {
    prisma.workoutPlan = {
      findFirst: vi.fn().mockResolvedValue({ id: 'wp-1', source: 'manual' }),
    };
    prisma.dietPlan = { findFirst: vi.fn().mockResolvedValue(null) };

    const ctx = await getActiveOfficialPlanContext('user-1');
    expect(ctx.userCanEditPlanStructure).toBe(true);
  });
});
