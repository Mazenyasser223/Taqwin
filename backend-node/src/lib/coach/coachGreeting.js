/**
 * Short greeting / small-talk turns for the coach (EN + AR).
 */

const GREETING_ONLY =
  /^\s*(hi|hello|hey|hiya|yo|sup|what'?s\s*up|wassup|good\s*(morning|afternoon|evening|night)|how\s*(are|r)\s*(you|u)|how\s*do\s*you\s*do|greetings|salam|assalamu?\s*alaikum|marhaba|marhaban|مرحبا|مرحباً|أهلا|اهلا|السلام\s*عليكم|سلام|صباح\s*ال?خير|مساء\s*ال?خير|هلا|هاي|ازيك|إزيك|إزيك\s*عامل\s*ا?يه|عامل\s*ا?يه|عاملة\s*ا?يه|إيه\s*ال?أ?خبار|ايه\s*ال?أ?خبار|اخبارك|أخبارك|كيف\s*حالك|شلونك)(?:[\s,!.?…]*(?:there|coach|taqwin|تكوين|مدرب)?)?[\s!.?…]*$/i;

function isGreetingMessage(message) {
  const text = String(message || '').trim();
  if (!text) return false;
  if (text.split(/\s+/).length > 8) return false;
  return GREETING_ONLY.test(text);
}

function buildGreetingReply({ locale = 'en', displayName } = {}) {
  const name = String(displayName || '').trim();
  const first = name.split(/\s+/)[0] || '';

  if (locale === 'ar') {
    if (first) {
      return `أهلاً ${first}! الحمد لله كويس. إزيك؟ تحب أساعدك في التمرين، التغذية، ولا أي حاجة في تكوين؟`;
    }
    return 'أهلاً! الحمد لله كويس. إزيك؟ تحب أساعدك في التمرين، التغذية، ولا أي حاجة في تكوين؟';
  }

  if (first) {
    return `Hey ${first}! I'm doing great — thanks for checking in. How are you? I can help with training, nutrition, or anything in the Taqwin app.`;
  }
  return "Hey! I'm doing great — thanks for checking in. How are you? I can help with training, nutrition, or anything in the Taqwin app.";
}

module.exports = {
  isGreetingMessage,
  buildGreetingReply,
};
