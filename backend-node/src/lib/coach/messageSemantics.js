/**
 * Shared semantic patterns — Taqwin coach in-domain detection (Node).
 * Keeps off-topic guard aligned with B7 intent categories (platform, fitness, profile).
 */

/** Taqwin app / platform (same intent family as platform_help). */
const PLATFORM_PATTERNS = [
  /\b(taqwin|takween|takwin)\b/i,
  /(تكوين|تكوّين|التطبيق|المنصة|البرنامج|الموقع)/,
  /\b(smart\s*coach|ai\s*coach|fitness\s*app)\b/i,
  /\b(onboarding|dashboard|subscription|account|sign\s*up|log\s*in|settings|profile)\b/i,
  /(اشتراك|حساب|تسجيل|دخول|لوحة|الداشبورد|المدرب\s*الذكي|استبيان|بروفايل|إعدادات|الإعدادات)/,
  /\b(community|feed|stories|marketplace|gym|membership|trainer)\b/i,
  /(مجتمع|كوميونيتي|ستوري|ستوريز|بوست|منشور|نادي|جيم|صالة|عضوية|مدرب|متجر|مكملات|ماركت)/,
];

/** Question phrasing — meta / definition (still in-domain for Taqwin coach). */
const META_QUESTION_PATTERNS = [
  /\b(who\s+is|what\s+is|what\s+are|what\s+do|how\s+does|tell\s+me\s+about|help\s+me|can\s+you)\b/i,
  /\b(features?|about\s+the\s+app|how\s+to\s+use|how\s+do\s+i)\b/i,
  /(من\s+هي|من\s+هو|ما\s+هو|ما\s+هي|مين\s+هي|مين\s+هو|ايه\s+هو|إيه\s+هو|ايه\s+هي|إيه\s+هي|عرفني|اشرح|وضح|ميزات|خدمات|بتعمل\s+ايه|بتعمل\s+إيه|ازاي\s+اشتغل|إزاي\s+اشتغل|كيف\s+أستخدم|ازاي\s+استخدم|إزاي\s+استخدم)/,
];

/** Coach persona / capabilities (in-domain). */
const COACH_META_PATTERNS = [
  /\b(who\s+are\s+you|what\s+can\s+you\s+do|your\s+role)\b/i,
  /(مين\s*انت|انت\s*مين|إنت\s*مين|انت\s*ايه|إنت\s*إيه|تقدر\s*تعمل|تقدر\s*تساعد|تعمل\s*ايه|تعمل\s*إيه|مساعدة|ساعدني|ساعدني)/,
];

/** Fitness / nutrition / health (core coach domain). */
const FITNESS_PATTERNS = [
  /\b(workout|exercise|gym|cardio|train|training|reps?|sets?|squat|deadlift|bench|press|row|curl|core|abs|plank|push[-\s]?up|pull[-\s]?up|hiit|running|jog|sprint|mobility|stretch|warm[-\s]?up|cool[-\s]?down|recovery|rest day|injury|injuries|pain|sore)\b/i,
  /\b(diet|meal\s*plan|nutrition|macro|calorie|kcal|protein|carb|fat|fiber|fibre|water|hydration|food|eat|eating|breakfast|lunch|dinner|snack|recipe|fast|fasting|ramadan|halal|kosher|vegan|vegetarian|supplement|whey|creatine)\b/i,
  /\b(weight|fat\s*loss|lose|cut|bulk|gain|muscle|hypertrophy|strength|endurance|stamina|fitness|health|wellness|sleep|stress|habit|posture|bmi|tdee|bmr|bf|body\s*fat|body\s*type|ectomorph|mesomorph|endomorph)\b/i,
  /(تمرين|تمارين|جيم|كارديو|بنش|سكوات|ديدليفت|رفع|مجموع|عدد|راحة|إصابة|اصابة|ألم|الم|تغذية|دايت|نظام\s*غذائي|سعرات|بروتين|كارب|دهون|ماء|أكل|اكل|وجبات|فطار|غدا|عشا|عشاء|سناك|سحور|إفطار|افطار|رمضان|حلال|نباتي|كيتو|واي|كرياتين|عضلات|عضل|نحف|تخسيس|تنشيف|بناء|قوة|تحمل|لياقة|صحة|نوم|عادة|قوام|طول|وزن|نوع\s*جسم|جسمي|نحيف|رياضي|ميزومورف|إكتومورف|اندومورف)/,
];

/** Profile / progress questions about the logged-in user. */
const PROFILE_PATTERNS = [
  /\b(my\s+(weight|progress|plan|meals?|workout|body|profile|data|stats))\b/i,
  /\b(how\s+am\s+i|what\s+did\s+i\s+log|logged\s+today)\b/i,
  /(وزني|تقدمي|سجلت|التزامي|وضعي|بياناتي|خطتي|برنامجي|تقدم|سجل\s*النهارده)/,
];

/** Chat memory / conversation meta. */
const CHAT_META_PATTERNS = [
  /\b(what did i say|what i said|you said|you sent|do you remember|remember what|earlier|previously|last (message|reply|time|question)|repeat (what|that)|our (chat|conversation)|send (me )?your last)\b/i,
  /(قبل\s*كده|قبل\s*كدا|قلت(?:ه|ي)?|قولت(?:ه|ي)?|فاكر|تذكر|ذكرت|المحادثة|شات|الشات)/,
  /(رسال[ةه]|رد|كلام)\s*(اللي|الي|الأخير|الاخير|آخر|اخر)/,
  /(آخر|اخر|أخر)\s*(رسال[ةه]|رد|كلام|سؤال)/,
  /(ابعت|ابعث|أبعت|أبعث|ابعثلي|ابعتلي|ابعه|ابعها|ارسل|أرسل|بعت|بعث)(?:لي|ليا|ه|ها)?/,
  /(انت|إنت|إنتي|انتي)\s*(بعت|قولت|كتبت|رديت|راسلت)/,
  /(كرر|اعيد|رد\s*تاني|قول\s*تاني|نفس\s*(الكلام|الرد|الرسالة))/,
];

const GREETING_PATTERN = /^\s*(hi|hello|hey|salam|اهلا|أهلا|مرحبا|السلام|صباح|مساء|ازيك|إزيك)\b/i;

const OUT_OF_DOMAIN_HARD_BLOCK = [
  /\b(write|generate|code|program|function|class|algorithm|sql\s*query)\b.*\b(python|javascript|typescript|java|c\+\+|sql|html|css|react|vue|angular|node)\b/i,
  /\b(weather|forecast|temperature)\b/i,
  /\b(stock|market|crypto|bitcoin|ethereum|investment)\b/i,
  /\b(world cup|election|president|war|geopolit)\b/i,
];

const LLM_JUDGE_SYSTEM = `You are a topic classifier for Taqwin's in-app fitness coach.

Reply with exactly one token: IN-DOMAIN or OFF-TOPIC.

IN-DOMAIN (default — use when unsure):
- Taqwin app, features, onboarding, dashboard, community, gym membership, smart coach
- Training, nutrition, recovery, supplements in a fitness context
- User profile, plans, logs, body type, progress on Taqwin
- Chat memory: repeat last message, what you/I said before, conversation history
- Short or vague fitness/Taqwin questions — still IN-DOMAIN

OFF-TOPIC only when clearly unrelated: coding homework, weather, stocks/crypto, politics, celebrity gossip, general trivia with no fitness/Taqwin link.`;

function matchesAny(text, patterns) {
  return patterns.some((re) => re.test(text));
}

/**
 * @param {string} text
 * @returns {'in-domain'|'off-topic'|'unknown'}
 */
function quickClassifyMessage(text) {
  const t = String(text || '').trim();
  if (!t) return 'unknown';
  if (matchesAny(t, OUT_OF_DOMAIN_HARD_BLOCK)) return 'off-topic';
  if (
    matchesAny(t, PLATFORM_PATTERNS) ||
    matchesAny(t, META_QUESTION_PATTERNS) ||
    matchesAny(t, COACH_META_PATTERNS) ||
    matchesAny(t, FITNESS_PATTERNS) ||
    matchesAny(t, PROFILE_PATTERNS) ||
    matchesAny(t, CHAT_META_PATTERNS) ||
    GREETING_PATTERN.test(t)
  ) {
    return 'in-domain';
  }
  return 'unknown';
}

/**
 * True when message should reach the coach (not the fixed off-topic redirect).
 * Unknown messages are allowed — only hard-block list rejects.
 */
function isCoachScopeMessage(text) {
  return quickClassifyMessage(text) !== 'off-topic';
}

/**
 * @param {string} text
 * @returns {string[]} hints e.g. ['platform', 'fitness']
 */
function semanticHints(text) {
  const t = String(text || '');
  const hints = [];
  if (matchesAny(t, PLATFORM_PATTERNS) || matchesAny(t, META_QUESTION_PATTERNS)) {
    hints.push('platform');
  }
  if (matchesAny(t, COACH_META_PATTERNS)) hints.push('coach');
  if (matchesAny(t, CHAT_META_PATTERNS)) hints.push('chat_memory');
  if (matchesAny(t, FITNESS_PATTERNS)) hints.push('fitness');
  if (matchesAny(t, PROFILE_PATTERNS)) hints.push('profile');
  if (/(نوع\s*جسم|body\s*type|ectomorph|mesomorph|endomorph|ميزومورف|إكتومورف)/i.test(t)) {
    hints.push('body_type');
  }
  return hints;
}

module.exports = {
  PLATFORM_PATTERNS,
  META_QUESTION_PATTERNS,
  COACH_META_PATTERNS,
  CHAT_META_PATTERNS,
  FITNESS_PATTERNS,
  LLM_JUDGE_SYSTEM,
  quickClassifyMessage,
  isCoachScopeMessage,
  semanticHints,
  OUT_OF_DOMAIN_HARD_BLOCK,
};
