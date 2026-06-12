import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { describeToolResult, executionSuccessReply } = requireFromHere(
  '../src/lib/coach/pendingActionReplies',
);

describe('pendingActionReplies', () => {
  it('describeToolResult formats log_food output', () => {
    const line = describeToolResult(
      'log_food',
      {
        success: true,
        output: {
          log: { grams: 200, foodItem: { name: 'Chicken breast' } },
        },
      },
      'en',
    );
    expect(line).toContain('Chicken breast');
    expect(line).toContain('200');
  });

  it('describeToolResult formats replace_exercise output', () => {
    const line = describeToolResult(
      'replace_exercise_today',
      {
        success: true,
        output: {
          replaced: { name: 'Bench Press' },
          exercise: { name: 'Dumbbell Press' },
        },
      },
      'en',
    );
    expect(line).toContain('Bench Press');
    expect(line).toContain('Dumbbell Press');
  });

  it('executionSuccessReply prefers detailed lines over generic text', () => {
    const reply = executionSuccessReply(
      ['log_food'],
      [
        {
          success: true,
          output: { log: { grams: 150, foodItem: { name: 'Rice' } } },
        },
      ],
      'en',
    );
    expect(reply).toContain('Rice');
    expect(reply).not.toContain('Done —');
  });
});
