/**
 * Adaptation decision engine — keep | micro | meso | macro (Block C9).
 */

const MACRO_CONFIRM = new Set(['macro']);

/**
 * @param {import('./signals').collectAdaptationSignals extends Function ? object : any} signals
 * @param {{ locale?: 'ar'|'en' }} [opts]
 * @returns {{
 *   decision: 'keep'|'micro'|'meso'|'macro',
 *   requiresConfirmation: boolean,
 *   plateauFlag: boolean,
 *   reasons: string[],
 *   reasonCodes: string[],
 *   summaryAr: string,
 *   summaryEn: string,
 * }}
 */
function evaluateAdaptation(signals, opts = {}) {
  const locale = opts.locale === 'en' ? 'en' : 'ar';
  const reasons = [];
  const reasonCodes = [];

  let decision = 'keep';
  let plateauFlag = false;

  const adherence = signals.overallAdherence ?? 0;

  if (signals.weightSpike) {
    decision = 'macro';
    reasonCodes.push('weight_spike');
    reasons.push(
      locale === 'ar'
        ? `تغيّر الوزن ${signals.weightDeltaKg} كجم خلال الأسبوع — مراجعة الخطة الكاملة.`
        : `Weight changed ${signals.weightDeltaKg} kg this week — full plan review.`
    );
  }

  if (signals.painReports > 0 || signals.recentChangeTypes?.includes('pain_report')) {
    if (decision !== 'macro') decision = 'micro';
    reasonCodes.push('pain');
    reasons.push(
      locale === 'ar'
        ? 'بلاغ ألم أو إصابة — تخفيف حمل اليوم وتبديل آمن.'
        : 'Pain or injury reported — reduce today’s load and safe swaps.'
    );
  }

  if (signals.missedWorkoutDays >= 3) {
    if (decision === 'keep' || decision === 'micro') decision = 'meso';
    reasonCodes.push('missed_workouts');
    reasons.push(
      locale === 'ar'
        ? `${signals.missedWorkoutDays} أيام تمرين فائتة — إعادة جدولة الأسبوع.`
        : `${signals.missedWorkoutDays} missed workout days — reschedule the week.`
    );
  }

  if (signals.lowReadinessStreak >= 3) {
    if (decision === 'keep') decision = 'micro';
    reasonCodes.push('low_readiness');
    reasons.push(
      locale === 'ar'
        ? 'جاهزية منخفضة 3 أيام متتالية — اقتراح deload خفيف.'
        : 'Low readiness 3 days in a row — light deload suggestion.'
    );
  }

  if (signals.plateauWeeks >= 2) {
    plateauFlag = true;
    if (decision === 'keep' || decision === 'micro') decision = 'meso';
    reasonCodes.push('plateau');
    reasons.push(
      locale === 'ar'
        ? 'ثبات تقدم 2+ أسابيع — تغيير هيكل الأسبوع.'
        : 'Progress plateau 2+ weeks — change weekly structure.'
    );
  }
  if (signals.plateauWeeks >= 3 && decision !== 'macro') {
    decision = 'macro';
    reasonCodes.push('plateau_macro');
    reasons.push(
      locale === 'ar'
        ? 'ثبات طويل — خطة جديدة بالكامل.'
        : 'Extended plateau — full new plan.'
    );
  }

  if (signals.negativeFeedback && adherence < 70) {
    if (decision === 'keep') decision = 'meso';
    reasonCodes.push('negative_feedback');
    reasons.push(
      locale === 'ar'
        ? 'تقييم سلبي للخطة مع التزام متوسط — تبسيط الأسبوع القادم.'
        : 'Negative plan feedback with moderate adherence — simplify next week.'
    );
  }

  if (adherence < 50) {
    if (decision === 'keep' || decision === 'micro') decision = 'meso';
    reasonCodes.push('low_adherence');
    reasons.push(
      locale === 'ar'
        ? `التزام ${adherence}% — تقليل الحجم واقتراح وضع حياة مناسب.`
        : `Adherence ${adherence}% — reduce volume and suggest a life mode.`
    );
  } else if (adherence >= 80 && decision === 'keep') {
    reasonCodes.push('strong_adherence');
    reasons.push(
      locale === 'ar'
        ? `التزام ممتاز (${adherence}%) — الإبقاء على المسار الحالي.`
        : `Strong adherence (${adherence}%) — stay on current track.`
    );
  } else if (adherence >= 50 && adherence < 80 && decision === 'keep') {
    reasonCodes.push('moderate_adherence');
    reasons.push(
      locale === 'ar'
        ? `التزام ${adherence}% — تعديلات بسيطة فقط عند الحاجة.`
        : `Adherence ${adherence}% — minor tweaks only when needed.`
    );
  }

  if (signals.chatSignalCount > 0 && decision === 'keep') {
    decision = 'micro';
    reasonCodes.push('chat_request');
    reasons.push(
      locale === 'ar'
        ? 'طلبت تعديلات عبر المحادثة — تطبيق تغييرات اليوم.'
        : 'You requested changes in chat — apply today’s adjustments.'
    );
  }

  if (signals.manualEditCount >= 2 && decision === 'keep') {
    decision = 'micro';
    reasonCodes.push('manual_edits');
    reasons.push(
      locale === 'ar'
        ? 'تعديلات يدوية متكررة — مزامنة الخطة مع سلوكك.'
        : 'Repeated manual edits — sync plan with your behavior.'
    );
  }

  const requiresConfirmation = MACRO_CONFIRM.has(decision);

  const summaryAr =
    reasons.length > 0
      ? reasons.join(' ')
      : 'لا تغييرات مطلوبة هذا الأسبوع.';
  const summaryEn =
    reasons.length > 0
      ? reasons.join(' ')
      : 'No plan changes required this week.';

  return {
    decision,
    requiresConfirmation,
    plateauFlag,
    reasons,
    reasonCodes,
    summaryAr,
    summaryEn,
    explainabilityText: locale === 'ar' ? summaryAr : summaryEn,
  };
}

module.exports = { evaluateAdaptation };
