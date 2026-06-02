/**
 * Off-topic guard for the AI coach.
 *
 * The coach is a fitness/nutrition/wellness assistant. When a user asks
 * something completely unrelated (e.g. "write me a Python function",
 * "what's the weather in Tokyo", "who won the World Cup in 1998") we
 * short-circuit with a fixed polite reply and skip the LLM call.
 *
 * The classifier is two-stage:
 *   1. Cheap keyword/regex pass — catches obvious in-domain queries
 *      (any food/exercise/health word triggers in-domain immediately).
 *   2. Optional LLM judge fallback — only when keywords were inconclusive,
 *      asks the LLM a yes/no classifier with a tiny prompt.
 *
 * Returns `{ inDomain, offTopicReply? }`.
 */
const { completeChat, resolveProvider } = require('../../services/aiChatProvider');

// Broad fitness/health vocabulary — Arabic + English.
const IN_DOMAIN_PATTERNS = [
  /\b(workout|exercise|gym|cardio|train|training|reps?|sets?|squat|deadlift|bench|press|row|curl|core|abs|plank|push[-\s]?up|pull[-\s]?up|hiit|running|jog|sprint|mobility|stretch|warm[-\s]?up|cool[-\s]?down|recovery|rest day|injury|injuries|pain|sore)\b/i,
  /\b(diet|meal\s*plan|nutrition|macro|calorie|kcal|protein|carb|fat|fiber|fibre|water|hydration|food|eat|eating|breakfast|lunch|dinner|snack|recipe|fast|fasting|ramadan|halal|kosher|vegan|vegetarian|supplement|whey|creatine)\b/i,
  /\b(weight|fat\s*loss|lose|cut|bulk|gain|muscle|hypertrophy|strength|endurance|stamina|fitness|health|wellness|sleep|stress|habit|posture|bmi|tdee|bmr|bf|body\s*fat)\b/i,
  /(تمرين|تمارين|جيم|كارديو|بنش|سكوات|ديدليفت|رفع|مجموع|عدد|راحة|إصابة|اصابة|ألم|الم|تغذية|دايت|نظام\s*غذائي|سعرات|بروتين|كارب|دهون|ماء|أكل|اكل|وجبات|فطار|غدا|عشا|عشاء|سناك|سحور|إفطار|افطار|رمضان|حلال|نباتي|كيتو|بروتين|واي|كرياتين|عضلات|عضل|دهون|نحف|تخسيس|تنشيف|بناء|قوة|تحمل|لياقة|صحة|نوم|عادة|قوام|طول|وزن)/,
  // Chat memory / meta — still in-domain (coach uses conversation history)
  /\b(what did i say|what i said|you said|do you remember|remember what|earlier|previously|last (message|time|question)|repeat (what|that)|our (chat|conversation))\b/i,
  /(قبل\s*كده|قبل\s*كدا|قلت(?:ه|ي)?|قولت(?:ه|ي)?|إ?[اأ]ي\s*اللي|فاكر|تذكر|ذكرت|المحادثة|الرسالة|الكلام\s*اللي|قول(?:ي|(?:ه|ا))\s*(?:تاني|مرة))/,
];

const OUT_OF_DOMAIN_HARD_BLOCK = [
  /\b(write|generate|code|program|function|class|algorithm|sql\s*query)\b.*\b(python|javascript|typescript|java|c\+\+|sql|html|css|react|vue|angular|node)\b/i,
  /\b(weather|forecast|temperature)\b/i,
  /\b(stock|market|crypto|bitcoin|ethereum|investment)\b/i,
  /\b(world cup|election|president|war|geopolit)\b/i,
];

const REPLY_AR =
  'أنا الكوتش بتاع تكوين 💪 — متخصص في التمرين والتغذية والاستشفاء بس. اسألني عن خطة تمرين، نظام أكل، إصابة، أو أي حاجة بتخص لياقتك.';
const REPLY_EN =
  "I'm Taqwin's coach — I focus on training, nutrition, and recovery. Ask me about a workout plan, a diet, an injury, or anything related to your fitness.";

function offTopicReplyFor(locale, userMessage) {
  const hasArabic = /[\u0600-\u06FF]/.test(String(userMessage || ''));
  if (hasArabic) return REPLY_AR;
  return locale === 'en' ? REPLY_EN : REPLY_AR;
}

function quickClassify(text) {
  if (!text) return 'unknown';
  for (const re of OUT_OF_DOMAIN_HARD_BLOCK) if (re.test(text)) return 'off-topic';
  for (const re of IN_DOMAIN_PATTERNS) if (re.test(text)) return 'in-domain';
  // Very short greetings / small talk are in-domain (coach handles them gracefully)
  if (/^\s*(hi|hello|hey|salam|اهلا|مرحبا|السلام|صباح|مساء)\b/i.test(text)) return 'in-domain';
  return 'unknown';
}

async function llmJudge(text) {
  if (!resolveProvider()) return null;
  try {
    const reply = await completeChat({
      system:
        'You are a strict topic classifier. Reply with a single word: IN-DOMAIN if the user message is about fitness, nutrition, training, exercise, injuries, sleep, recovery, health habits, OR questions about this chat/conversation (what they said before, remembering earlier messages). Otherwise reply OFF-TOPIC. No explanations, no other words.',
      messages: [{ role: 'user', content: text.slice(0, 600) }],
      temperature: 0,
      maxTokens: 8,
    });
    const t = String(reply || '').trim().toUpperCase();
    if (t.includes('IN-DOMAIN') || t === 'IN') return 'in-domain';
    if (t.includes('OFF-TOPIC') || t === 'OFF') return 'off-topic';
  } catch {
    /* swallow */
  }
  return null;
}

/**
 * @param {string} userMessage
 * @param {object} [opts]
 * @param {'ar'|'en'} [opts.locale='ar']
 * @param {boolean} [opts.allowJudge=true]
 * @returns {Promise<{ inDomain: boolean, offTopicReply?: string, reason: string }>}
 */
async function checkOffTopic(userMessage, { locale = 'ar', allowJudge = true } = {}) {
  const text = String(userMessage || '');
  const quick = quickClassify(text);
  if (quick === 'in-domain') return { inDomain: true, reason: 'keyword' };
  if (quick === 'off-topic') {
    return {
      inDomain: false,
      offTopicReply: offTopicReplyFor(locale, text),
      reason: 'keyword',
    };
  }

  if (!allowJudge || text.length < 8) {
    return { inDomain: true, reason: 'unknown-default-allow' };
  }

  const judged = await llmJudge(text);
  if (judged === 'off-topic') {
    return {
      inDomain: false,
      offTopicReply: offTopicReplyFor(locale, text),
      reason: 'llm-judge',
    };
  }
  return { inDomain: true, reason: judged || 'unknown-default-allow' };
}

module.exports = {
  checkOffTopic,
  quickClassify,
  REPLY_AR,
  REPLY_EN,
};
