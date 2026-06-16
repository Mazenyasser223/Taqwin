/**
 * User-facing copy when Claude plan generation is unavailable (credits, timeout, scaffold).
 * Never expose raw API errors to athletes — ops can read plan_generation_logs.
 */

const PLAN_AI_PENDING_CODE = 'PLAN_AI_PENDING';
const API_CODE = 'plan_ai_pending';

function planAiPendingUserMessage(locale = 'ar') {
  if (locale === 'en') {
    return (
      'Your personalized plan is being prepared by our coaching team. ' +
      'We will contact you shortly with your full workout and meal schedule.'
    );
  }
  return (
    'جاري تجهيز خطتك المخصصة من فريق التدريب. ' +
    'سنتواصل معك قريباً بجدول تمارينك ووجباتك الكامل.'
  );
}

/**
 * @param {{ locale?: 'ar'|'en', reason?: string }} [opts]
 */
function buildPlanAiPendingError(opts = {}) {
  const locale = opts.locale === 'en' ? 'en' : 'ar';
  const err = new Error(planAiPendingUserMessage(locale));
  err.code = PLAN_AI_PENDING_CODE;
  err.apiCode = API_CODE;
  err.statusCode = 503;
  if (opts.reason) err.internalReason = String(opts.reason).slice(0, 500);
  return err;
}

function isPlanAiPendingApiCode(code) {
  return code === API_CODE || code === PLAN_AI_PENDING_CODE;
}

module.exports = {
  PLAN_AI_PENDING_CODE,
  planAiPendingUserMessage,
  buildPlanAiPendingError,
  isPlanAiPendingApiCode,
};
