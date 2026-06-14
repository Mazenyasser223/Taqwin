/**
 * Adaptation-related in-app notifications (Block C9).
 */
const { emitNotification } = require('../notifications');

const TITLES = {
  ar: {
    plan_change: 'تعديل على خطتك',
    weekly_review_due: 'مراجعة أسبوعية',
    adaptation_applied: 'تحديث الخطة',
    macro_pending: 'تأكيد خطة جديدة',
  },
  en: {
    plan_change: 'Plan updated',
    weekly_review_due: 'Weekly review',
    adaptation_applied: 'Plan adaptation',
    macro_pending: 'Confirm new plan',
  },
};

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
  const locale = opts.locale === 'en' ? 'en' : 'ar';
  const titles = TITLES[locale];

  let message = '';
  let type = 'ai.adaptation';
  let link = opts.link || '/dashboard';

  if (opts.kind === 'plan_change') {
    type = 'ai.plan_change';
    const via =
      opts.triggeredBy === 'chat'
        ? locale === 'ar'
          ? 'المحادثة'
          : 'chat'
        : locale === 'ar'
          ? 'تعديلك اليدوي'
          : 'your manual edit';
    message =
      locale === 'ar'
        ? `سجّلنا تعديلاً (${opts.changeType || 'edit'}) عبر ${via}. الخطة ستتزامن مع مراجعتك الأسبوعية.`
        : `Recorded a ${opts.changeType || 'edit'} via ${via}. Your plan will align at the weekly review.`;
    if (opts.reason?.trim()) {
      message += ` ${opts.reason.trim().slice(0, 120)}`;
    }
  } else if (opts.kind === 'weekly_review_due') {
    type = 'ai.weekly_review';
    message =
      locale === 'ar'
        ? 'أكمل مراجعة الأسبوع (الوزن، الجاهزية، التقييم) لنحدد خطة الأسبوع القادم.'
        : 'Complete your weekly review (weight, readiness, feedback) so we can plan next week.';
    link = '/dashboard?weeklyReview=1';
  } else if (opts.kind === 'macro_pending') {
    type = 'ai.adaptation_macro';
    message =
      locale === 'ar'
        ? 'الذكاء الاصطناعي يقترح خطة جديدة بالكامل — أكّد من لوحة التحكم.'
        : 'AI suggests a full new plan — confirm from your dashboard.';
    link = '/dashboard?weeklyReview=1&macro=1';
  } else {
    type = 'ai.adaptation_applied';
    const d = opts.decision || 'keep';
    message =
      locale === 'ar'
        ? `قرار الأسبوع: ${d}. ${opts.reason?.slice(0, 200) || ''}`
        : `Weekly decision: ${d}. ${opts.reason?.slice(0, 200) || ''}`;
  }

  return emitNotification({
    userId: opts.userId,
    type,
    title: titles[opts.kind] || titles.adaptation_applied,
    message: message.trim(),
    link,
  });
}

module.exports = { emitAdaptationNotification };
