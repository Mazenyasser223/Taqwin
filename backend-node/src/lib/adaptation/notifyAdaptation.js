/**
 * Adaptation-related in-app notifications (Block C9).
 */
const { emitNotification } = require('../notifications');

/**
 * @param {{
 *   userId: string,
 *   kind: 'plan_change'|'weekly_review_due'|'adaptation_applied'|'macro_pending',
 *   locale?: 'ar'|'en',
 *   changeType?: string,
 *   triggeredBy?: string,
 *   decision?: string,
 *   reason?: string,
 *   link?: string,
 * }} opts
 */
async function emitAdaptationNotification(opts) {
  let type = 'ai.adaptation';
  let link = opts.link || '/dashboard';

  if (opts.kind === 'plan_change') {
    type = 'ai.plan_change';
  } else if (opts.kind === 'weekly_review_due') {
    type = 'ai.weekly_review';
    link = '/dashboard?weeklyReview=1';
  } else if (opts.kind === 'macro_pending') {
    type = 'ai.adaptation_macro';
    link = '/dashboard?weeklyReview=1&macro=1';
  } else {
    type = 'ai.adaptation_applied';
  }

  return emitNotification({
    userId: opts.userId,
    type,
    link,
    payload: {
      kind: opts.kind,
      changeType: opts.changeType,
      triggeredBy: opts.triggeredBy,
      decision: opts.decision,
      reason: opts.reason,
    },
  });
}

module.exports = { emitAdaptationNotification };
