import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);

describe('coach tool integration (log_food audit shape)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('buildExecuteReply returns food-specific success text', async () => {
    const { buildExecuteReply } = requireFromHere('../src/services/pendingActionExecute');
    const pending = {
      tools: ['log_food'],
      locale: 'en',
      userMessage: 'log 200g chicken',
    };
    const results = [
      {
        tool: 'log_food',
        success: true,
        output: {
          log: { grams: 200, foodItem: { name: 'Chicken breast' } },
        },
      },
    ];
    const reply = buildExecuteReply(pending, results, null);
    expect(reply).toContain('Chicken breast');
    expect(reply).toContain('200');
  });

  it('uses unified coach conversation storage key name', () => {
    expect('taqwin.coach.conversationId').toMatch(/^taqwin\.coach\./);
  });
});
