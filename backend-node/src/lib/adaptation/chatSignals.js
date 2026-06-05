/**
 * Detect plan-change intent in coach chat and record + notify.
 */
const { detectPainInText } = require('./signals');
const { recordPlanChange } = require('./planChangeLog');

const ADAPT_CHAT_RE =
  /بدّل|بدل|غيّر|غير|تعديل|خفّف|خفف|استبدل|بديل|swap|replace|change plan|تغيير الخطة|إلغاء اليوم|skip|راحة إضافية/i;

/**
 * @param {string} userId
 * @param {string} message
 * @param {{ locale?: 'ar'|'en' }} [opts]
 */
async function maybeRecordChatAdaptationSignal(userId, message, opts = {}) {
  const text = String(message || '').trim();
  if (!text || text.length < 4) return null;
  if (!ADAPT_CHAT_RE.test(text) && !detectPainInText(text)) return null;

  const changeType = detectPainInText(text) ? 'pain_report' : 'chat_adapt';
  return recordPlanChange({
    userId,
    changeType,
    reason: text.slice(0, 500),
    triggeredBy: 'chat',
    locale: opts.locale,
    notify: true,
  });
}

module.exports = { maybeRecordChatAdaptationSignal, ADAPT_CHAT_RE };
