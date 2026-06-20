/**
 * Shared coach semantics — single Node source for in-domain guard, action hints,
 * adaptation keywords, and confirm/cancel turn signals.
 *
 * FastAPI intent router remains the primary tool classifier; this module hard-blocks
 * off-topic and supplies offline fallbacks only.
 */
const { detectPainInText } = require('../adaptation/signals');
const { isGreetingMessage } = require('./coachGreeting');

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

const META_QUESTION_PATTERNS = [
  /\b(who\s+is|what\s+is|what\s+are|what\s+do|how\s+does|tell\s+me\s+about|help\s+me|can\s+you)\b/i,
  /\b(features?|about\s+the\s+app|how\s+to\s+use|how\s+do\s+i)\b/i,
  /(من\s+هي|من\s+هو|ما\s+هو|ما\s+هي|مين\s+هي|مين\s+هو|ايه\s+هو|إيه\s+هو|ايه\s+هي|إيه\s+هي|عرفني|اشرح|وضح|ميزات|خدمات|بتعمل\s+ايه|بتعمل\s+إيه|ازاي\s+اشتغل|إزاي\s+اشتغل|كيف\s+أستخدم|ازاي\s+استخدم|إزاي\s+استخدم)/,
];

const COACH_META_PATTERNS = [
  /\b(who\s+are\s+you|what\s+can\s+you\s+do|your\s+role)\b/i,
  /(مين\s*انت|انت\s*مين|إنت\s*مين|انت\s*ايه|إنت\s*إيه|تقدر\s*تعمل|تقدر\s*تساعد|تعمل\s*ايه|تعمل\s*إيه|مساعدة|ساعدني|ساعدني)/,
];

const FITNESS_PATTERNS = [
  /\b(workout|exercise|gym|cardio|train|training|reps?|sets?|squat|deadlift|bench|press|row|curl|core|abs|plank|push[-\s]?up|pull[-\s]?up|hiit|running|jog|sprint|mobility|stretch|warm[-\s]?up|cool[-\s]?down|recovery|rest day|injury|injuries|pain|sore)\b/i,
  /\b(diet|meal\s*plan|nutrition|macro|calorie|kcal|protein|carb|fat|fiber|fibre|water|hydration|food|eat|eating|breakfast|lunch|dinner|snack|recipe|fast|fasting|ramadan|halal|kosher|vegan|vegetarian|supplement|whey|creatine)\b/i,
  /\b(weight|fat\s*loss|lose|cut|bulk|gain|muscle|hypertrophy|strength|endurance|stamina|fitness|health|wellness|sleep|stress|habit|posture|bmi|tdee|bmr|bf|body\s*fat|body\s*type|ectomorph|mesomorph|endomorph)\b/i,
  /(تمرين|تمارين|جيم|كارديو|بنش|سكوات|ديدليفت|رفع|مجموع|عدد|راحة|إصابة|اصابة|ألم|الم|تغذية|دايت|نظام\s*غذائي|سعرات|بروتين|كارب|دهون|ماء|أكل|اكل|وجبات|فطار|غدا|عشا|عشاء|سناك|سحور|إفطار|افطار|رمضان|حلال|نباتي|كيتو|واي|كرياتين|عضلات|عضل|نحف|تخسيس|تنشيف|بناء|قوة|تحمل|لياقة|صحة|نوم|عادة|قوام|طول|وزن|نوع\s*جسم|جسمي|نحيف|رياضي|ميزومورف|إكتومورف|اندومورف)/,
];

const PROFILE_PATTERNS = [
  /\b(my\s+(weight|progress|plan|meals?|workout|body|profile|data|stats))\b/i,
  /\b(how\s+am\s+i|what\s+did\s+i\s+log|logged\s+today)\b/i,
  /(وزني|تقدمي|سجلت|التزامي|وضعي|بياناتي|خطتي|برنامجي|تقدم|سجل\s*النهارده)/,
];

const CHAT_META_PATTERNS = [
  /\b(what did i say|what i said|you said|you sent|do you remember|remember what|earlier|previously|last (message|reply|time|question)|repeat (what|that)|our (chat|conversation)|send (me )?your last)\b/i,
  /(قبل\s*كده|قبل\s*كدا|قلت(?:ه|ي)?|قولت(?:ه|ي)?|فاكر|تذكر|ذكرت|المحادثة|شات|الشات)/,
  /(رسال[ةه]|رد|كلام)\s*(اللي|الي|الأخير|الاخير|آخر|اخر)/,
  /(آخر|اخر|أخر)\s*(رسال[ةه]|رد|كلام|سؤال)/,
  /(ابعت|ابعث|أبعت|أبعث|ابعثلي|ابعتلي|ابعه|ابعها|ارسل|أرسل|بعت|بعث)(?:لي|ليا|ه|ها)?/,
  /(انت|إنت|إنتي|انتي)\s*(بعت|قولت|كتبت|رديت|راسلت)/,
  /(كرر|اعيد|رد\s*تاني|قول\s*تاني|نفس\s*(الكلام|الرد|الرسالة))/,
];


const OUT_OF_DOMAIN_HARD_BLOCK = [
  /\b(write|generate|code|program|function|class|algorithm|sql\s*query)\b.*\b(python|javascript|typescript|java|c\+\+|sql|html|css|react|vue|angular|node)\b/i,
  /\b(weather|forecast|temperature)\b/i,
  /\b(stock|market|crypto|bitcoin|ethereum|investment)\b/i,
  /\b(world cup|election|president|war|geopolit)\b/i,
];

const CHAT_ACTION_PATTERNS = [
  /\b(log|record|track|add)\b.*\b(meal|meals|food|lunch|dinner|breakfast)\b/i,
  /\b(replace|swap|substitute|change|skip)\b.+\b(with|for|today|exercise|workout)\b/i,
  /\b(set|switch|activate)\b.*\b(life\s*mode|travel|ramadan|fasting)\b/i,
  /\b(simplify|adapt|reschedule)\b.*\b(plan|week)\b/i,
  /(سجل|سجّل|ضيف|أضف|بدّل|بدل|استبدل|تبسيط|عدّل|عدل).*(وجبة|أكل|تمرين|خطة|رمضان|سفر)/i,
];

const ADAPT_CHAT_RE =
  /بدّل|بدل|غيّر|غير|تعديل|خفّف|خفف|استبدل|بديل|swap|replace|change plan|تغيير الخطة|إلغاء اليوم|skip|راحة إضافية/i;

const CONFIRM_EN =
  /\b(yes|yeah|yep|yup|confirm|confirmed|ok(?:ay)?|go ahead|do it|proceed|sure|affirmative)\b/i;
const CONFIRM_AR =
  /(نعم|أكد|تأكيد|موافق|تمام|يلا|نفّذ|نفذ|اوكي|حسنا|ايوه|آه|اه|ماشي|تمام\s*نفذ|يلا\s*نفذ)/i;
const CANCEL_EN = /\b(no|nope|cancel|cancelled|stop|never\s?mind|don't|do not)\b/i;
const CANCEL_AR = /(لا|إلغاء|الغاء|ألغ|الغ|وقف|توقف|مش\s*عايز|مش\s*عاوز|بلاش|سيبها|الغي|الغِ)/i;

const ADAPTATION_TOOLS = new Set(['adapt_plan', 'replace_exercise_today', 'set_life_mode']);

function matchesAny(text, patterns) {
  return patterns.some((re) => re.test(text));
}

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
    isGreetingMessage(t)
  ) {
    return 'in-domain';
  }
  return 'unknown';
}

function isCoachScopeMessage(text) {
  return quickClassifyMessage(text) !== 'off-topic';
}

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

function looksLikeChatAction(message) {
  const text = String(message || '').trim();
  if (!text) return false;
  return CHAT_ACTION_PATTERNS.some((re) => re.test(text));
}

function hasCancelSignal(text) {
  const t = String(text || '').trim();
  return CANCEL_EN.test(t) || CANCEL_AR.test(t);
}

function hasConfirmSignal(text) {
  const t = String(text || '').trim();
  if (!t || hasCancelSignal(t)) return false;
  return CONFIRM_EN.test(t) || CONFIRM_AR.test(t);
}

function classifyTurnLocal(message, _locale = 'ar') {
  const text = String(message || '').trim();
  if (!text) return 'neutral';
  if (hasCancelSignal(text)) return 'cancel';
  if (hasConfirmSignal(text)) return 'confirm';
  return 'neutral';
}

function shouldRecordAdaptationFromChat(text, toolNames = []) {
  const msg = String(text || '').trim();
  if (!msg || msg.length < 4) return null;
  if (detectPainInText(msg)) return 'pain_report';

  const tools = toolNames || [];
  const selfLoggingTools = ['replace_exercise_today', 'set_life_mode', 'adapt_plan'];
  if (tools.some((name) => selfLoggingTools.includes(name))) return null;

  if (tools.some((name) => ADAPTATION_TOOLS.has(name)) || ADAPT_CHAT_RE.test(msg)) {
    return 'chat_adapt';
  }
  return null;
}

module.exports = {
  PLATFORM_PATTERNS,
  META_QUESTION_PATTERNS,
  COACH_META_PATTERNS,
  CHAT_META_PATTERNS,
  FITNESS_PATTERNS,
  CHAT_ACTION_PATTERNS,
  ADAPT_CHAT_RE,
  CONFIRM_EN,
  CONFIRM_AR,
  CANCEL_EN,
  CANCEL_AR,
  ADAPTATION_TOOLS,
  OUT_OF_DOMAIN_HARD_BLOCK,
  quickClassifyMessage,
  isCoachScopeMessage,
  semanticHints,
  looksLikeChatAction,
  hasCancelSignal,
  hasConfirmSignal,
  classifyTurnLocal,
  shouldRecordAdaptationFromChat,
};
