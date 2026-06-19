/**
 * Poll option labels must use the same text moderation as post bodies.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { moderateContent, ModerationError } = requireFromHere('../src/lib/moderation');

describe('moderateContent poll options', () => {
  it('allows clean poll option labels', async () => {
    await expect(
      moderateContent({
        text: 'Which workout do you prefer?',
        pollOptionLabels: ['Push day', 'Pull day', 'Leg day'],
        lang: 'en',
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects profanity in poll option labels', async () => {
    await expect(
      moderateContent({
        text: 'Pick one',
        pollOptionLabels: ['Option A', 'كس امك'],
        lang: 'ar',
      }),
    ).rejects.toBeInstanceOf(ModerationError);
  });

  it('rejects profanity in poll options even when question text is clean', async () => {
    await expect(
      moderateContent({
        text: 'What is your favorite exercise?',
        pollOptionLabels: ['Squats', 'fuck this'],
        lang: 'en',
      }),
    ).rejects.toBeInstanceOf(ModerationError);
  });
});
