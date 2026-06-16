import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  resolveReviewSentiment,
  aggregateSentimentLabels,
  computeStarSentiment,
} = require('../src/lib/gymReviewAnalysis');

describe('gymReviewAnalysis', () => {
  it('prioritizes negative text over high star rating', () => {
    expect(
      resolveReviewSentiment({ rating: 5, body: 'المعدات كلها قديمه وسيئه' }),
    ).toBe('negative');
  });

  it('prioritizes positive text over low star rating', () => {
    expect(
      resolveReviewSentiment({ rating: 1, body: 'Staff were great and very friendly' }),
    ).toBe('positive');
  });

  it('uses stars when text is neutral or empty', () => {
    expect(resolveReviewSentiment({ rating: 5, body: 'Nice gym overall' })).toBe('positive');
    expect(resolveReviewSentiment({ rating: 2, body: '' })).toBe('negative');
  });

  it('aggregates per-review labels into percentages', () => {
    expect(
      aggregateSentimentLabels(['positive', 'positive', 'negative', 'neutral']),
    ).toEqual({ positive: 50, neutral: 25, negative: 25 });
  });

  it('computeStarSentiment applies text-over-stars for fallback path', () => {
    const result = computeStarSentiment([
      { rating: 5, body: 'المعدات كلها قديمه وسيئه' },
      { rating: 5, body: 'ممتاز ونظيف' },
    ]);
    expect(result.negative).toBeGreaterThan(0);
    expect(result.positive + result.neutral + result.negative).toBe(100);
  });
});
