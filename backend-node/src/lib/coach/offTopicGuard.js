/**
 * Off-topic guard for the AI coach — uses shared coachSemantics patterns.
 */
const { quickClassifyMessage, isCoachScopeMessage } = require('./coachSemantics');

const REPLY_AR =
  'أنا الكوتش بتاع تكوين 💪 — متخصص في التمرين والتغذية والاستشفاء وميزات التطبيق. اسألني عن خطة تمرين، نظام أكل، إصابة، بياناتك على تكوين، أو أي حاجة ليها علاقة باللياقة والمنصة.';
const REPLY_EN =
  "I'm Taqwin's coach — I focus on training, nutrition, recovery, and how the Taqwin app works. Ask about your plan, diet, progress, app features, or anything fitness-related on Taqwin.";

function offTopicReplyFor(locale, userMessage) {
  const hasArabic = /[\u0600-\u06FF]/.test(String(userMessage || ''));
  if (hasArabic) return REPLY_AR;
  return locale === 'en' ? REPLY_EN : REPLY_AR;
}

function quickClassify(text) {
  return quickClassifyMessage(text);
}

async function checkOffTopic(userMessage, { locale = 'ar' } = {}) {
  const text = String(userMessage || '').trim();
  if (!text) return { inDomain: true, reason: 'empty' };

  const quick = quickClassify(text);
  if (quick === 'in-domain') return { inDomain: true, reason: 'semantic' };

  if (!isCoachScopeMessage(text)) {
    return {
      inDomain: false,
      offTopicReply: offTopicReplyFor(locale, text),
      reason: 'hard-block',
    };
  }

  return { inDomain: true, reason: quick === 'unknown' ? 'default-allow' : 'semantic' };
}

module.exports = {
  checkOffTopic,
  quickClassify,
  REPLY_AR,
  REPLY_EN,
};
