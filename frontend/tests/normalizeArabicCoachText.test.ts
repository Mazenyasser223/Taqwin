import { describe, expect, it } from 'vitest';
import { normalizeArabicCoachText } from '../lib/normalizeArabicCoachText';

describe('normalizeArabicCoachText', () => {
  it('merges broken spaces inside Arabic words from LLM output', () => {
    const input = 'تكوين ه ي منصة لل رياضيين. مح تاجها في الم ميزات الرئيسية.';
    const out = normalizeArabicCoachText(input);
    expect(out).toContain('تكوين هي منصة');
    expect(out).toContain('للرياضيين');
    expect(out).toContain('محتاجها');
    expect(out).toContain('المميزات');
  });

  it('keeps normal spaces between Arabic words', () => {
    const input = 'تكوين هي منصة لياقة بدنية متكاملة للرياضيين';
    expect(normalizeArabicCoachText(input)).toBe(input);
  });

  it('keeps spaces after common standalone Arabic words', () => {
    const input = 'محتاج مساعدة في التمرين من البداية';
    expect(normalizeArabicCoachText(input)).toBe(input);
  });

  it('leaves English text unchanged', () => {
    const input = 'Hello world — smart coach reply.';
    expect(normalizeArabicCoachText(input)).toBe(input);
  });
});
