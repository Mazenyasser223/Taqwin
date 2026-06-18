/**
 * Localized notification copy — rendered from type + payload at read/emit time.
 */

function actorLabel(actors, count, lang) {
  const list = Array.isArray(actors) ? actors : [];
  const name = list[0]?.displayName || list[0]?.name || 'Someone';
  const n = count || list.length || 1;
  if (n <= 1) return name;
  if (n === 2) {
    const second = list[1]?.displayName || list[1]?.name || (lang === 'ar' ? 'آخر' : 'someone');
    return lang === 'ar' ? `${name} و${second}` : `${name} and ${second}`;
  }
  const others = n - 1;
  return lang === 'ar' ? `${name} و${others} آخرين` : `${name} and ${others} others`;
}

const TEMPLATES = {
  'community.reaction': {
    en: (p) => ({
      title: actorLabel(p.actors, p.actorCount, 'en'),
      message:
        (p.actorCount || 1) > 1
          ? `${actorLabel(p.actors, p.actorCount, 'en')} liked your post`
          : `${p.actorName || 'Someone'} reacted to your post`,
    }),
    ar: (p) => ({
      title: actorLabel(p.actors, p.actorCount, 'ar'),
      message:
        (p.actorCount || 1) > 1
          ? `${actorLabel(p.actors, p.actorCount, 'ar')} أعجبوا بمنشورك`
          : `${p.actorName || 'شخص'} تفاعل مع منشورك`,
    }),
  },
  'community.comment': {
    en: (p) => ({
      title: (p.actorCount || 1) > 1 ? 'New comments' : p.actorName || 'Someone',
      message:
        (p.actorCount || 1) > 1
          ? `${p.actorCount} new comments on your ${p.contentLabel || 'post'}`
          : `${p.actorName || 'Someone'} commented on your post`,
    }),
    ar: (p) => ({
      title: (p.actorCount || 1) > 1 ? 'تعليقات جديدة' : p.actorName || 'شخص',
      message:
        (p.actorCount || 1) > 1
          ? `${p.actorCount} تعليقات جديدة على ${p.contentLabelAr || 'منشورك'}`
          : `${p.actorName || 'شخص'} علّق على منشورك`,
    }),
  },
  'community.comment_reply': {
    en: (p) => ({
      title: p.actorName || 'Someone',
      message: `${p.actorName || 'Someone'} replied to your comment`,
    }),
    ar: (p) => ({
      title: p.actorName || 'شخص',
      message: `${p.actorName || 'شخص'} رد على تعليقك`,
    }),
  },
  'community.follow': {
    en: (p) => ({ title: p.actorName || 'Someone', message: `${p.actorName || 'Someone'} started following you` }),
    ar: (p) => ({ title: p.actorName || 'شخص', message: `بدأ ${p.actorName || 'شخص'} بمتابعتك` }),
  },
  'community.follow_request': {
    en: (p) => ({ title: p.actorName || 'Someone', message: `${p.actorName || 'Someone'} requested to follow you` }),
    ar: (p) => ({ title: p.actorName || 'شخص', message: `طلب ${p.actorName || 'شخص'} متابعتك` }),
  },
  'community.follow_accepted': {
    en: (p) => ({ title: p.actorName || 'Someone', message: `${p.actorName || 'Someone'} accepted your follow request` }),
    ar: (p) => ({ title: p.actorName || 'شخص', message: `قبل ${p.actorName || 'شخص'} طلب متابعتك` }),
  },
  'community.group_invite': {
    en: (p) => ({ title: p.actorName || 'Someone', message: `${p.actorName || 'Someone'} invited you to "${p.groupName || 'a group'}"` }),
    ar: (p) => ({ title: p.actorName || 'شخص', message: `دعاك ${p.actorName || 'شخص'} إلى "${p.groupName || 'مجموعة'}"` }),
  },
  'community.group_join_request': {
    en: (p) => ({ title: p.actorName || 'Someone', message: `${p.actorName || 'Someone'} requested to join "${p.groupName || 'your group'}"` }),
    ar: (p) => ({ title: p.actorName || 'شخص', message: `طلب ${p.actorName || 'شخص'} الانضمام إلى "${p.groupName || 'مجموعتك'}"` }),
  },
  'community.message': {
    en: (p) => ({ title: p.actorName || 'Someone', message: p.preview || `${p.actorName || 'Someone'} sent you a message` }),
    ar: (p) => ({ title: p.actorName || 'شخص', message: p.preview || `أرسل ${p.actorName || 'شخص'} رسالة` }),
  },
  'community.ring': {
    en: (p) => ({ title: p.actorName || 'Someone', message: `${p.actorName || 'Someone'} added a new story` }),
    ar: (p) => ({ title: p.actorName || 'شخص', message: `أضاف ${p.actorName || 'شخص'} قصة جديدة` }),
  },
  'workout.reminder': {
    en: (p) => ({
      title: (p.collapsedCount || 1) > 1 ? `Workout reminders (${p.collapsedCount})` : 'Workout reminder',
      message: p.message || 'You have a workout scheduled today.',
    }),
    ar: (p) => ({
      title: (p.collapsedCount || 1) > 1 ? `تذكيرات التمرين (${p.collapsedCount})` : 'تذكير التمرين',
      message: p.message || 'لديك تمرين مجدول اليوم.',
    }),
  },
  'plan.meal_reminder': {
    en: (p) => ({
      title: (p.collapsedCount || 1) > 1 ? `Meal reminders (${p.collapsedCount})` : 'Meal reminder',
      message: p.message || `Time for ${p.mealLabel || 'your meal'}.`,
    }),
    ar: (p) => ({
      title: (p.collapsedCount || 1) > 1 ? `تذكيرات الوجبات (${p.collapsedCount})` : 'تذكير الوجبة',
      message: p.message || `حان وقت ${p.mealLabel || 'وجبتك'}.`,
    }),
  },
  'fitness.daily_digest': {
    en: (p) => ({
      title: 'Morning summary',
      message: p.summary || 'Your daily fitness overview is ready.',
    }),
    ar: (p) => ({
      title: 'ملخص الصباح',
      message: p.summary || 'ملخص لياقتك اليومي جاهز.',
    }),
  },
  'fitness.streak_milestone': {
    en: (p) => ({ title: '🔥 Streak milestone!', message: `You hit a ${p.days}-day streak. Keep it going!` }),
    ar: (p) => ({ title: '🔥 إنجاز سلسلة!', message: `وصلت إلى سلسلة ${p.days} يوم. استمر!` }),
  },
  'fitness.pr_achieved': {
    en: (p) => ({ title: '🏅 Personal record!', message: `New PR on ${p.exerciseName}: ${p.value}` }),
    ar: (p) => ({ title: '🏅 رقم قياسي!', message: `رقم جديد في ${p.exerciseName}: ${p.value}` }),
  },
  'fitness.recovery_changed': {
    en: (p) => ({ title: '💤 Recovery update', message: `Your recovery score is now ${p.score}%` }),
    ar: (p) => ({ title: '💤 تحديث التعافي', message: `درجة تعافيك الآن ${p.score}%` }),
  },
  'fitness.hydration_goal': {
    en: () => ({ title: '💧 Hydration goal', message: 'You reached your water goal today!' }),
    ar: () => ({ title: '💧 هدف الترطيب', message: 'حققت هدف الماء اليوم!' }),
  },
  'fitness.weekly_summary': {
    en: (p) => ({ title: '📈 Weekly progress', message: p.summary || 'Your weekly progress summary is ready.' }),
    ar: (p) => ({ title: '📈 تقدم أسبوعي', message: p.summary || 'ملخص تقدمك الأسبوعي جاهز.' }),
  },
  'fitness.macro_target': {
    en: () => ({ title: '🍽️ Macro target reached', message: 'You hit your macro target for today.' }),
    ar: () => ({ title: '🍽️ هدف الماكرو', message: 'حققت هدف الماكرو اليوم.' }),
  },
  'fitness.weight_trend': {
    en: (p) => ({ title: '⚖️ Weight trend', message: p.message || 'Your weight trend has shifted.' }),
    ar: (p) => ({ title: '⚖️ اتجاه الوزن', message: p.message || 'اتجاه وزنك تغيّر.' }),
  },
  'fitness.ai_insight': {
    en: (p) => ({ title: '🤖 Coach insight', message: p.insight || 'Your AI coach has a tip for you.' }),
    ar: (p) => ({ title: '🤖 نصيحة المدرب', message: p.insight || 'مدربك الذكي لديه نصيحة لك.' }),
  },
  'fitness.coach_feedback': {
    en: (p) => ({ title: '👥 Coach feedback', message: p.message || 'Your coach left feedback on your session.' }),
    ar: (p) => ({ title: '👥 ملاحظات المدرب', message: p.message || 'ترك مدربك ملاحظات على جلستك.' }),
  },
  'coach.feedback_available': {
    en: (p) => ({
      title: '👥 Coach feedback available',
      message: p.message || p.coachMessage || 'Your coach has new feedback for you.',
    }),
    ar: (p) => ({
      title: '👥 ملاحظات المدرب متاحة',
      message: p.message || p.coachMessage || 'مدربك لديه ملاحظات جديدة لك.',
    }),
  },
  'fitness.heart_rate_anomaly': {
    en: (p) => ({ title: '❤️ Heart rate alert', message: p.message || 'Unusual heart rate pattern detected.' }),
    ar: (p) => ({ title: '❤️ تنبيه نبض', message: p.message || 'تم رصد نمط نبض غير معتاد.' }),
  },
  'support.received': {
    en: (p) => ({ title: 'Support', message: p.message || 'We received your support request.' }),
    ar: (p) => ({ title: 'الدعم', message: p.message || 'استلمنا طلب الدعم.' }),
  },
  'support.reply': {
    en: (p) => ({ title: 'Support reply', message: p.message || 'Our team replied to your ticket.' }),
    ar: (p) => ({ title: 'رد الدعم', message: p.message || 'رد فريقنا على تذكرتك.' }),
  },
};

function renderNotification(type, payload = {}, lang = 'en') {
  const locale = lang === 'ar' ? 'ar' : 'en';
  const tmpl = TEMPLATES[type];
  if (tmpl) {
    const fn = tmpl[locale] || tmpl.en;
    return fn(payload);
  }
  if (payload.title && payload.message) {
    return { title: payload.title, message: payload.message };
  }
  return {
    title: payload.title || type,
    message: payload.message || '',
  };
}

module.exports = { renderNotification, actorLabel, TEMPLATES };
