import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { executeTool } = requireFromHere('../src/services/aiToolExecutor');

const TEST_USER_ID = '11111111-1111-4111-8111-111111111111';
const MISSING_USER_ID = '00000000-0000-4000-8000-000000000000';

describe('aiToolExecutor', () => {
  it('executes ping and logs success', async () => {
    const result = await executeTool({
      userId: TEST_USER_ID,
      toolName: 'ping',
      input: {},
    });

    expect(result.success).toBe(true);
    expect(result.output).toMatchObject({ ok: true, block: 'A4' });
    expect(result.executionId).toBe('exec-test-1');
  });

  it('returns failure for unknown tool but still logs', async () => {
    const result = await executeTool({
      userId: TEST_USER_ID,
      toolName: 'not_a_tool',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown tool');
    expect(result.executionId).toBe('exec-test-1');
  });

  it('fails when user not found', async () => {
    const result = await executeTool({
      userId: MISSING_USER_ID,
      toolName: 'echo',
      input: { hello: 1 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('User not found');
  });
});
