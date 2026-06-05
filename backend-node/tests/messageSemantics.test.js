import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  quickClassifyMessage,
  semanticHints,
  isCoachScopeMessage,
} = requireFromHere('../src/lib/coach/messageSemantics');
const { checkOffTopic, quickClassify } = requireFromHere('../src/lib/coach/offTopicGuard');

describe('messageSemantics', () => {
  it('treats Taqwin identity paraphrases as in-domain', () => {
    for (const msg of [
      'من هي تكوين؟',
      'ما هي ميزات تطبيق تكوين',
      'what is Taqwin app',
      'who is takween',
    ]) {
      expect(quickClassifyMessage(msg)).toBe('in-domain');
      expect(semanticHints(msg)).toContain('platform');
    }
  });

  it('treats body type questions as in-domain', () => {
    expect(quickClassifyMessage('عايز اعرف نوع جسمي')).toBe('in-domain');
    expect(semanticHints('عايز اعرف نوع جسمي')).toContain('body_type');
  });

  it('treats chat memory paraphrases as in-domain', () => {
    const msg = 'ابعثلي اخر رساله انت بعتها';
    expect(quickClassifyMessage(msg)).toBe('in-domain');
    expect(semanticHints(msg)).toContain('chat_memory');
  });

  it('treats coach persona questions as in-domain', () => {
    expect(quickClassifyMessage('مين انت وبتعمل ايه')).toBe('in-domain');
    expect(semanticHints('مين انت وبتعمل ايه')).toContain('coach');
  });

  it('allows unknown fitness-ish messages (default allow)', () => {
    expect(quickClassifyMessage('عايز نصيحة للنوم بعد التمرين')).toBe('in-domain');
    expect(isCoachScopeMessage('ممكن توضحلي الفكرة دي')).toBe(true);
  });

  it('offTopic guard allows platform and chat memory without fixed redirect', async () => {
    for (const msg of ['من هي تكوين؟', 'ابعثلي اخر رساله انت بعتها']) {
      const r = await checkOffTopic(msg);
      expect(r.inDomain).toBe(true);
      expect(r.offTopicReply).toBeUndefined();
    }
  });

  it('still blocks coding requests via hard block', () => {
    expect(quickClassify('write me a python function for sorting')).toBe('off-topic');
    expect(isCoachScopeMessage('write me a python function for sorting')).toBe(false);
  });

  it('still blocks weather and stocks', async () => {
    for (const msg of ['what is the weather tomorrow', 'should I buy bitcoin']) {
      expect(quickClassify(msg)).toBe('off-topic');
      const r = await checkOffTopic(msg, { locale: 'en' });
      expect(r.inDomain).toBe(false);
      expect(r.offTopicReply).toBeDefined();
    }
  });
});
