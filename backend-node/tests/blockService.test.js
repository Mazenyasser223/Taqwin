/**
 * Block list helpers (no DB).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const blockService = requireFromHere('../src/services/community/blockService');

describe('blockService exports', () => {
  it('exposes listUsersBlockedBy', () => {
    expect(typeof blockService.listUsersBlockedBy).toBe('function');
  });
});
