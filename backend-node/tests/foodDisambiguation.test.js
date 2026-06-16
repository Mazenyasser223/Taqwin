import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  serializeCandidates,
  normalizeCandidate,
  pendingForClient,
  disambiguationReply,
} = requireFromHere('../src/lib/coach/foodDisambiguation');
const { updatePendingAction, savePendingAction, getPendingByActionId } = requireFromHere(
  '../src/services/pendingActionService',
);

describe('foodDisambiguation', () => {
  it('serializeCandidates keeps foodItemId or webtebId', () => {
    const rows = serializeCandidates([
      { foodItemId: '11111111-1111-4111-8111-111111111111', foodName: 'Chicken', grams: 200 },
      { webtebId: 42, foodName: 'Rice', nameAr: 'أرز', grams: 150 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].foodItemId).toBeTruthy();
    expect(rows[1].webtebId).toBe(42);
  });

  it('normalizeCandidate rejects invalid rows', () => {
    expect(normalizeCandidate({ foodName: 'x' })).toBeNull();
    expect(normalizeCandidate({ webtebId: 5, foodName: 'x', grams: 100 })?.webtebId).toBe(5);
  });

  it('pendingForClient exposes disambiguation view', () => {
    const view = pendingForClient({
      actionId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      phase: 'disambiguation',
      preview: 'Log food',
      tools: ['log_food'],
      locale: 'en',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      disambiguation: {
        kind: 'food',
        query: 'chicken',
        candidates: [{ foodName: 'A', foodItemId: '11111111-1111-4111-8111-111111111111', grams: 200 }],
      },
    });
    expect(view?.disambiguationRequired).toBe(true);
    expect(view?.candidates).toHaveLength(1);
  });

  it('disambiguationReply is localized', () => {
    expect(disambiguationReply('en', 'chicken')).toContain('chicken');
    expect(disambiguationReply('ar', 'دجاج')).toContain('دجاج');
  });
});

describe('pendingActionService disambiguation fields', () => {
  it('updatePendingAction preserves action and switches phase', async () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const { actionId } = await savePendingAction({
      userId,
      conversationId: 'conv-disambig',
      tools: ['log_food', 'replace_exercise_today'],
      inputsByTool: { log_food: { rawText: '200g chicken' } },
      preview: 'Log food + replace exercise',
      intent: 'execute_action',
      userMessage: 'log chicken and replace bench',
      locale: 'en',
      phase: 'disambiguation',
      disambiguation: {
        kind: 'food',
        query: 'chicken',
        candidates: [
          { foodItemId: '22222222-2222-4222-8222-222222222222', foodName: 'Chicken A', grams: 200 },
          { foodItemId: '33333333-3333-4333-8333-333333333333', foodName: 'Chicken B', grams: 200 },
        ],
      },
    });

    const updated = await updatePendingAction(userId, actionId, {
      phase: 'confirm',
      inputsByTool: {
        log_food: {
          foodItemId: '22222222-2222-4222-8222-222222222222',
          foodName: 'Chicken A',
          grams: 200,
        },
        replace_exercise_today: { request: 'replace bench with db press' },
      },
      disambiguation: null,
    });

    expect(updated?.phase).toBe('confirm');
    expect(updated?.inputsByTool.log_food.foodItemId).toBeTruthy();
    expect(updated?.tools).toEqual(['log_food', 'replace_exercise_today']);
    expect(await getPendingByActionId(userId, actionId)).toBeTruthy();
  });
});
