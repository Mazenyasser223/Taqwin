import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  shouldRecordAdaptationFromChat,
  looksLikeChatAction,
  classifyTurnLocal,
} = requireFromHere('../src/lib/coach/coachSemantics');

describe('coachSemantics', () => {
  it('looksLikeChatAction detects EN and AR action phrases', () => {
    expect(looksLikeChatAction('log 200g chicken for lunch')).toBe(true);
    expect(looksLikeChatAction('بدّلي تمرين النهارده')).toBe(true);
    expect(looksLikeChatAction('what is high protein breakfast')).toBe(false);
  });

  it('classifyTurnLocal detects confirm/cancel variants', () => {
    expect(classifyTurnLocal('نعم', 'ar')).toBe('confirm');
    expect(classifyTurnLocal('مش عايز', 'ar')).toBe('cancel');
  });

  it('shouldRecordAdaptationFromChat skips self-logging tools', () => {
    expect(
      shouldRecordAdaptationFromChat('بدّل تمرين النهارده', ['replace_exercise_today']),
    ).toBeNull();
  });

  it('shouldRecordAdaptationFromChat records pain after tools', () => {
    expect(shouldRecordAdaptationFromChat('عندي ألم في الكتف', ['log_food'])).toBe('pain_report');
  });
});

describe('chat history contract (server merge)', () => {
  it('uses only the latest user turn from the client payload', () => {
    const clientPayload = [
      { role: 'model', content: 'old assistant' },
      { role: 'user', content: 'stale turn' },
      { role: 'user', content: 'latest turn' },
    ];
    const historyMessages = [
      { role: 'user', content: 'persisted 1' },
      { role: 'model', content: 'persisted reply' },
    ];

    const lastUserTurn = [...clientPayload].reverse().find((m) => m.role === 'user');
    const llmMessages = [...historyMessages, ...(lastUserTurn ? [lastUserTurn] : [])].slice(-30);

    expect(llmMessages.filter((m) => m.role === 'user').map((m) => m.content)).toEqual([
      'persisted 1',
      'latest turn',
    ]);
    expect(llmMessages.some((m) => m.content === 'stale turn')).toBe(false);
  });
});
