/**
 * Record plan-change signals after successful coach tool execution (not on every chat turn).
 */
const { recordPlanChange } = require('./planChangeLog');
const { shouldRecordAdaptationFromChat } = require('../coach/coachSemantics');

/**
 * @param {string} userId
 * @param {string} message
 * @param {string[]} toolNames
 * @param {{ locale?: 'ar'|'en', success?: boolean }} [opts]
 */
async function recordChatAdaptationAfterTools(userId, message, toolNames, opts = {}) {
  if (opts.success === false) return null;
  const changeType = shouldRecordAdaptationFromChat(message, toolNames);
  if (!changeType) return null;

  return recordPlanChange({
    userId,
    changeType,
    reason: String(message || '').slice(0, 500),
    triggeredBy: 'chat',
    locale: opts.locale,
    notify: true,
  });
}

/** @deprecated Use recordChatAdaptationAfterTools after tool execution only. */
async function maybeRecordChatAdaptationSignal(userId, message, opts = {}) {
  return recordChatAdaptationAfterTools(userId, message, [], opts);
}

module.exports = {
  recordChatAdaptationAfterTools,
  maybeRecordChatAdaptationSignal,
  ADAPT_CHAT_RE: require('../coach/coachSemantics').ADAPT_CHAT_RE,
};
