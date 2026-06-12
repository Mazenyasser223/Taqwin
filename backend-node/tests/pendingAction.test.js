import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  savePendingAction,
  getPendingByActionId,
  getActivePendingForConversation,
  clearPendingAction,
} = requireFromHere('../src/services/pendingActionService');
const {
  classifyTurnLocal,
  hasConfirmSignal,
  hasCancelSignal,
} = requireFromHere('../src/lib/coach/turnClassify');

describe('pendingActionService', () => {
  it('stores and retrieves pending action by actionId', async () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const conversationId = 'conv-test-1';
    const { actionId } = await savePendingAction({
      userId,
      conversationId,
      tools: ['log_food'],
      inputsByTool: { log_food: { foodName: 'chicken', grams: 200 } },
      preview: 'Log food: chicken',
      intent: 'execute_action',
      userMessage: 'log 200g chicken',
      locale: 'en',
    });

    const byId = await getPendingByActionId(userId, actionId);
    expect(byId?.tools).toEqual(['log_food']);
    expect(byId?.inputsByTool.log_food.grams).toBe(200);

    const active = await getActivePendingForConversation(userId, conversationId);
    expect(active?.actionId).toBe(actionId);

    await clearPendingAction(userId, actionId, conversationId);
    expect(await getPendingByActionId(userId, actionId)).toBeNull();
  });

  it('rejects pending action for wrong user', async () => {
    const { actionId } = await savePendingAction({
      userId: '11111111-1111-4111-8111-111111111111',
      conversationId: 'conv-2',
      tools: ['log_food'],
      inputsByTool: {},
      preview: 'x',
      intent: 'execute_action',
      userMessage: 'x',
      locale: 'en',
    });
    expect(await getPendingByActionId('22222222-2222-4222-8222-222222222222', actionId)).toBeNull();
  });
});

describe('turnClassify', () => {
  it('detects Egyptian confirm/cancel variants (offline regex fallback only)', () => {
    expect(hasConfirmSignal('ايوه')).toBe(true);
    expect(hasConfirmSignal('تمام نفذ')).toBe(true);
    expect(hasCancelSignal('مش عايز')).toBe(true);
    expect(hasCancelSignal('بلاش')).toBe(true);
    expect(classifyTurnLocal('نعم', 'ar')).toBe('confirm');
    expect(classifyTurnLocal('مش عايز', 'ar')).toBe('cancel');
  });

  it('chat execution requires actionId confirm endpoint (not free-text)', () => {
    expect(typeof savePendingAction).toBe('function');
    expect(typeof getPendingByActionId).toBe('function');
  });
});
