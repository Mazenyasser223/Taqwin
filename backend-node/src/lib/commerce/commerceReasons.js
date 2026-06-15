/**
 * Personalized "Explain Why" copy for each recommended product (EN + AR).
 */

function goalLabel(goalKey, primaryGoal, locale) {
  if (primaryGoal) return String(primaryGoal);
  const map = {
    muscle: locale === 'en' ? 'muscle gain' : 'بناء العضلات',
    lose: locale === 'en' ? 'fat loss' : 'خسارة الدهون',
    endurance: locale === 'en' ? 'endurance' : 'التحمل',
    maintain: locale === 'en' ? 'wellness' : 'العافية',
  };
  return map[goalKey] || map.muscle;
}

function trainingDaysLabel(days, locale) {
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) {
    return locale === 'en' ? 'your training schedule' : 'جدول تمرينك';
  }
  return locale === 'en' ? `${n} days per week` : `${n} أيام في الأسبوع`;
}

/**
 * @param {string} slot
 * @param {object} ctx
 * @param {'en'|'ar'} locale
 */
function buildReasonCopy(slot, ctx, locale = 'ar') {
  const {
    goalKey,
    primaryGoal,
    proteinTargetG,
    trainingDaysPerWeek,
  } = ctx;
  const goal = goalLabel(goalKey, primaryGoal, locale);
  const proteinG = proteinTargetG ? Math.round(proteinTargetG) : null;
  const days = trainingDaysLabel(trainingDaysPerWeek, locale);

  if (locale === 'en') {
    switch (slot) {
      case 'protein':
        return proteinG
          ? `Because your goal is ${goal} and your daily protein target is ${proteinG}g.`
          : `Because your goal is ${goal} and you need reliable protein support.`;
      case 'creatine':
        return `Because you train ${days} and want strength progression.`;
      case 'shaker':
        return 'To help you consume supplements conveniently.';
      case 'pre_workout':
        return `Because your ${goal} plan benefits from pre-session energy.`;
      case 'fbt':
        return 'Frequently bought together by athletes like you.';
      case 'diet_plan':
        return 'Used in your personalized meal plan.';
      default:
        return 'Recommended for your current plan and goals.';
    }
  }

  switch (slot) {
    case 'protein':
      return proteinG
        ? `لأن هدفك ${goal} وهدف البروتين اليومي ${proteinG} جم.`
        : `لأن هدفك ${goal} وتحتاج دعم بروتين ثابت.`;
    case 'creatine':
      return `لأنك تتمرن ${days} وعايز تطور قوتك.`;
    case 'shaker':
      return 'عشان تاخد المكملات بسهولة.';
    case 'pre_workout':
      return `لأن خطة ${goal} بتستفيد من طاقة قبل التمرين.`;
    case 'fbt':
      return 'رياضيين زيك بيشتروه مع بعض كتير.';
    case 'diet_plan':
      return 'مستخدم في خطتك الغذائية المخصصة.';
    default:
      return 'مقترح حسب خطتك وأهدافك الحالية.';
  }
}

module.exports = { buildReasonCopy, goalLabel };
