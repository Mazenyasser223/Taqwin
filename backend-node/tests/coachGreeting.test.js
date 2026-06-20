import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { isGreetingMessage, buildGreetingReply } = requireFromHere('../src/lib/coach/coachGreeting.js');

describe('coachGreeting', () => {
  it('detects short EN greetings', () => {
    expect(isGreetingMessage('hi')).toBe(true);
    expect(isGreetingMessage('Hello!')).toBe(true);
    expect(isGreetingMessage('How are you?')).toBe(true);
  });

  it('detects short AR greetings', () => {
    expect(isGreetingMessage('ازيك')).toBe(true);
    expect(isGreetingMessage('إزيك عامل ايه')).toBe(true);
  });

  it('does not treat fitness questions as greetings', () => {
    expect(isGreetingMessage('What should I eat for lunch?')).toBe(false);
  });

  it('builds personalized EN reply', () => {
    const reply = buildGreetingReply({ locale: 'en', displayName: 'Mazen Ali' });
    expect(reply).toContain('Mazen');
    expect(reply.toLowerCase()).toContain('training');
  });
});
