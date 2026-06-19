/**
 * Validation middleware — ensures z.object({ body }) wrappers work.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { normalizeSchema } from '../src/middleware/validate.js';

describe('validate normalizeSchema', () => {
  it('unwraps z.object({ body }) style schemas', () => {
    const wrapped = z.object({
      body: z.object({ language: z.enum(['en', 'ar']) }).strict(),
    });
    const normalized = normalizeSchema(wrapped);
    expect(normalized.body).toBeDefined();
    expect(normalized.body.parse({ language: 'en' })).toEqual({ language: 'en' });
  });

  it('passes through plain object schemas', () => {
    const plain = { body: z.object({ theme: z.enum(['light', 'dark']) }) };
    const normalized = normalizeSchema(plain);
    expect(normalized.body.parse({ theme: 'dark' })).toEqual({ theme: 'dark' });
  });

  it('rejects unknown keys on strict settings body', () => {
    const wrapped = z.object({
      body: z.object({ language: z.enum(['en', 'ar']).optional() }).strict(),
    });
    const normalized = normalizeSchema(wrapped);
    expect(() => normalized.body.parse({ totallyUnknown: 'x' })).toThrow();
  });
});

describe('pickSettingsUpdate', () => {
  it('only allows whitelisted keys', async () => {
    const { pickSettingsUpdate } = await import('../src/lib/userSettings.js');
    const data = pickSettingsUpdate({
      language: 'ar',
      notifyPromotional: false,
      evil: true,
    });
    expect(data).toEqual({ language: 'ar', notifyPromotional: false });
    expect(data.evil).toBeUndefined();
  });
});
