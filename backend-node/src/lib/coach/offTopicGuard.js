/**
 * Off-topic guard for the AI coach.
 *
 * Uses shared semantic patterns (messageSemantics.js) so paraphrases like
 * "من هي تكوين؟" and "ما هي ميزات التطبيق؟" stay in-domain and reach FastAPI + RAG.
 */
const { quickClassifyMessage, isCoachScopeMessage } = require('./messageSemantics');

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

/**
 * Off-topic guard — allow-by-default for Taqwin coach scope.
 *
 * Only explicit hard-block patterns (coding, weather, markets, politics) short-circuit.
 * Paraphrases and chat-memory questions always reach the LLM + conversation history.
 *
 * @param {string} userMessage
 * @param {object} [opts]
 * @param {'ar'|'en'} [opts.locale='ar']
 * @returns {Promise<{ inDomain: boolean, offTopicReply?: string, reason: string }>}
 */
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
