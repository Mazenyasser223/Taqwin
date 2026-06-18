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

function tierLabel(tier, lang) {
  const labels = {
    en: { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', diamond: 'Diamond' },
    ar: { bronze: 'برونزي', silver: 'فضي', gold: 'ذهبي', diamond: 'ماسي' },
  };
  return labels[lang]?.[tier] ?? tier;
}

function mealLabel(label, lang) {
  const key = String(label || '').toLowerCase();
  const labels = {
    en: { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', snack: 'your snack' },
    ar: { breakfast: 'الفطور', lunch: 'الغداء', dinner: 'العشاء', snack: 'وجبتك الخفيفة' },
  };
  return labels[lang]?.[key] || label || (lang === 'ar' ? 'وجبتك' : 'your meal');
}

function adaptationDecisionLabel(decision, lang) {
  const key = String(decision || 'keep').toLowerCase();
  const labels = {
    en: {
      keep: 'keeping your current plan',
      micro: 'small adjustments to this week',
      meso: 'updating your training block',
      macro: 'a bigger plan change',
      macro_pending: 'a new nutrition plan to confirm',
    },
    ar: {
      keep: 'الإبقاء على خطتك الحالية',
      micro: 'تعديلات بسيطة لهذا الأسبوع',
      meso: 'تحديث بلوك التمرين',
      macro: 'تغيير أكبر في الخطة',
      macro_pending: 'خطة تغذية جديدة للتأكيد',
    },
  };
  return labels[lang]?.[key] || key;
}

/** Use payload prose only when it matches the target locale (avoids English leaking into Arabic). */
function payloadCopy(p, key, lang) {
  if (!p) return null;
  const localized = p[`${key}${lang === 'ar' ? 'Ar' : 'En'}`];
  if (localized != null && String(localized).trim() !== '') return String(localized);
  const locale = p.copyLocale || p.locale;
  if (locale && locale !== lang) return null;
  const value = p[key];
  return value != null && String(value).trim() !== '' ? String(value) : null;
}

function weightTrendMessage(p, lang) {
  if (p.deltaKg == null || !p.days) return null;
  const kg = Math.abs(Number(p.deltaKg));
  if (lang === 'ar') {
    const verb = Number(p.deltaKg) < 0 ? 'انخفض' : 'ارتفع';
    return `${verb} وزنك ${kg} كجم خلال ${p.days} يوم.`;
  }
  const verb = Number(p.deltaKg) < 0 ? 'lost' : 'gained';
  return `You ${verb} ${kg}kg over the last ${p.days} days.`;
}

function aiInsightMessage(p, lang) {
  if (p.exerciseName == null || p.percentChange == null) return null;
  const name = lang === 'ar' ? p.exerciseNameAr || p.exerciseName : p.exerciseNameEn || p.exerciseName;
  if (lang === 'ar') {
    return `تحسّن أداؤك في ${name} بنسبة ${p.percentChange}% هذا الأسبوع.`;
  }
  return `Your ${name} performance improved ${p.percentChange}% this week.`;
}

const TEMPLATES = {
  'community.reaction': {
    en: (p) => {
      const name = p.actorName || 'Someone';
      const emoji = p.emoji ? ` ${p.emoji}` : '';
      if ((p.actorCount || 1) > 1) {
        return {
          title: actorLabel(p.actors, p.actorCount, 'en'),
          message: `${actorLabel(p.actors, p.actorCount, 'en')} liked your post`,
        };
      }
      return { title: name, message: `${name} reacted${emoji} to your post` };
    },
    ar: (p) => {
      const name = p.actorName || 'شخص';
      const emoji = p.emoji ? ` ${p.emoji}` : '';
      if ((p.actorCount || 1) > 1) {
        return {
          title: actorLabel(p.actors, p.actorCount, 'ar'),
          message: `${actorLabel(p.actors, p.actorCount, 'ar')} أعجبوا بمنشورك`,
        };
      }
      return { title: name, message: `${name} تفاعل${emoji} مع منشورك` };
    },
  },
  'community.comment': {
    en: (p) => {
      const preview = payloadCopy(p, 'preview', 'en');
      return {
        title: (p.actorCount || 1) > 1 ? '💬 New comments' : '💬 New comment',
        message:
          (p.actorCount || 1) > 1
            ? `${p.actorCount} new comments on your ${p.contentLabel || 'post'}.`
            : preview
              ? `${p.actorName || 'Someone'}: "${preview}"`
              : `${p.actorName || 'Someone'} commented on your post.`,
      };
    },
    ar: (p) => {
      const preview = payloadCopy(p, 'preview', 'ar');
      return {
        title: (p.actorCount || 1) > 1 ? '💬 تعليقات جديدة' : '💬 تعليق جديد',
        message:
          (p.actorCount || 1) > 1
            ? `${p.actorCount} تعليقات جديدة على ${p.contentLabelAr || 'منشورك'}.`
            : preview
              ? `${p.actorName || 'شخص'}: "${preview}"`
              : `${p.actorName || 'شخص'} علّق على منشورك.`,
      };
    },
  },
  'community.comment_reply': {
    en: (p) => ({
      title: '↩️ Reply to your comment',
      message: `${p.actorName || 'Someone'} replied to your comment.`,
    }),
    ar: (p) => ({
      title: '↩️ رد على تعليقك',
      message: `${p.actorName || 'شخص'} رد على تعليقك.`,
    }),
  },
  'community.follow': {
    en: (p) => ({
      title: '👤 New follower',
      message: `${p.actorName || 'Someone'} started following you.`,
    }),
    ar: (p) => ({
      title: '👤 متابع جديد',
      message: `بدأ ${p.actorName || 'شخص'} بمتابعتك.`,
    }),
  },
  'community.follow_request': {
    en: (p) => ({
      title: '👤 Follow request',
      message: `${p.actorName || 'Someone'} wants to follow you.`,
    }),
    ar: (p) => ({
      title: '👤 طلب متابعة',
      message: `طلب ${p.actorName || 'شخص'} متابعتك.`,
    }),
  },
  'community.follow_accepted': {
    en: (p) => ({
      title: '✅ Request accepted',
      message: `${p.actorName || 'Someone'} accepted your follow request.`,
    }),
    ar: (p) => ({
      title: '✅ تم قبول الطلب',
      message: `قبل ${p.actorName || 'شخص'} طلب متابعتك.`,
    }),
  },
  'community.group_invite': {
    en: (p) => ({
      title: '👥 Group invite',
      message: `${p.actorName || 'Someone'} invited you to join "${p.groupName || 'a group'}".`,
    }),
    ar: (p) => ({
      title: '👥 دعوة لمجموعة',
      message: `دعاك ${p.actorName || 'شخص'} للانضمام إلى "${p.groupName || 'مجموعة'}".`,
    }),
  },
  'community.group_join_request': {
    en: (p) => ({
      title: '👥 Join request',
      message: `${p.actorName || 'Someone'} wants to join "${p.groupName || 'your group'}".`,
    }),
    ar: (p) => ({
      title: '👥 طلب انضمام',
      message: `يريد ${p.actorName || 'شخص'} الانضمام إلى "${p.groupName || 'مجموعتك'}".`,
    }),
  },
  'community.message': {
    en: (p) => {
      const preview = payloadCopy(p, 'preview', 'en');
      return {
        title: `💬 ${p.actorName || 'New message'}`,
        message: preview ? `"${preview}"` : `${p.actorName || 'Someone'} sent you a message.`,
      };
    },
    ar: (p) => {
      const preview = payloadCopy(p, 'preview', 'ar');
      return {
        title: `💬 ${p.actorName || 'رسالة جديدة'}`,
        message: preview ? `"${preview}"` : `أرسل لك ${p.actorName || 'شخص'} رسالة.`,
      };
    },
  },
  'community.message_request': {
    en: (p) => ({
      title: '💬 Message request',
      message: `${p.actorName || 'Someone'} wants to message you.`,
    }),
    ar: (p) => ({
      title: '💬 طلب مراسلة',
      message: `يريد ${p.actorName || 'شخص'} مراسلتك.`,
    }),
  },
  'community.ring': {
    en: (p) => {
      const label = p.contentKind === 'story' ? 'story' : 'post';
      return { title: p.actorName || 'Someone', message: `${p.actorName || 'Someone'} added a new ${label}` };
    },
    ar: (p) => {
      const label = p.contentKind === 'story' ? 'قصة' : 'منشورًا';
      return { title: p.actorName || 'شخص', message: `أضاف ${p.actorName || 'شخص'} ${label} جديدًا` };
    },
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
      title: (p.collapsedCount || 1) > 1 ? `🍽️ Meal reminders (${p.collapsedCount})` : '🍽️ Meal time',
      message:
        p.message ||
        `Time for ${mealLabel(p.mealLabel, 'en')}. Log it to stay on track with your nutrition.`,
    }),
    ar: (p) => ({
      title: (p.collapsedCount || 1) > 1 ? `🍽️ تذكيرات الوجبات (${p.collapsedCount})` : '🍽️ وقت الوجبة',
      message:
        p.message ||
        `حان وقت ${mealLabel(p.mealLabel, 'ar')}. سجّلها لمتابعة تغذيتك.`,
    }),
  },
  'fitness.daily_digest': {
    en: (p) => ({
      title: '☀️ Your day at a glance',
      message: payloadCopy(p, 'summary', 'en') || 'Workouts, steps, and recovery — your daily snapshot is ready.',
    }),
    ar: (p) => ({
      title: '☀️ يومك في لمحة',
      message: payloadCopy(p, 'summary', 'ar') || 'تمارينك وخطواتك وتعافيك — ملخص يومك جاهز.',
    }),
  },
  'fitness.streak_milestone': {
    en: (p) => ({
      title: '🔥 Streak milestone!',
      message: `${p.days} days in a row — consistency is paying off. Keep the momentum going!`,
    }),
    ar: (p) => ({
      title: '🔥 إنجاز سلسلة!',
      message: `${p.days} يومًا متتاليًا — الاستمرارية تُثمر. واصل التقدّم!`,
    }),
  },
  'fitness.pr_achieved': {
    en: (p) => ({
      title: '🏅 New personal record!',
      message: `${p.exerciseName || 'Exercise'}: ${p.value} — that's your best yet.`,
    }),
    ar: (p) => ({
      title: '🏅 رقم قياسي جديد!',
      message: `${p.exerciseName || 'تمرين'}: ${p.value} — أفضل رقم لك حتى الآن.`,
    }),
  },
  'fitness.recovery_changed': {
    en: (p) => {
      const score = p.score;
      let message = `Recovery is at ${score}%`;
      if (Number.isFinite(p.delta) && p.delta < 0) message += ` (down ${Math.abs(p.delta)} pts)`;
      else if (Number.isFinite(p.delta) && p.delta > 0) message += ` (up ${p.delta} pts)`;
      message += '. Adjust training if you feel run down.';
      return { title: '💤 Recovery update', message };
    },
    ar: (p) => {
      const score = p.score;
      let message = `التعافي عند ${score}%`;
      if (Number.isFinite(p.delta) && p.delta < 0) message += ` (انخفض ${Math.abs(p.delta)} نقطة)`;
      else if (Number.isFinite(p.delta) && p.delta > 0) message += ` (ارتفع ${p.delta} نقطة)`;
      message += '. خفّف الشدة إذا شعرت بالإرهاق.';
      return { title: '💤 تحديث التعافي', message };
    },
  },
  'fitness.recovery_critical': {
    en: (p) => ({
      title: '🚨 Recovery is low',
      message:
        p.message ||
        `Recovery is at ${p.score || 'below 50'}% — consider a lighter session or extra rest today.`,
    }),
    ar: (p) => ({
      title: '🚨 تعافٍ منخفض',
      message:
        p.message ||
        `التعافي عند ${p.score || 'أقل من 50'}% — فكّر في جلسة أخف أو راحة إضافية اليوم.`,
    }),
  },
  'fitness.workout_missed': {
    en: (p) => {
      const name = p.workoutNameEn || p.workoutName;
      return {
        title: '🏋️ Workout missed',
        message: name
          ? `You missed "${name}" yesterday. Pick it up today or reschedule in your plan.`
          : 'You missed a planned workout yesterday. A short session still counts.',
      };
    },
    ar: (p) => {
      const name = p.workoutNameAr || p.workoutName;
      return {
        title: '🏋️ تمرين فائت',
        message: name
          ? `فاتك "${name}" أمس. أكمله اليوم أو أعد جدولته في خطتك.`
          : 'فاتك تمرين مجدول أمس. حتى جلسة قصيرة تُحسب.',
      };
    },
  },
  'fitness.hydration_goal': {
    en: () => ({ title: '💧 Hydration goal hit!', message: 'You reached your water target today. Great habit.' }),
    ar: () => ({ title: '💧 هدف الماء!', message: 'حققت هدف شرب الماء اليوم. عادة رائعة.' }),
  },
  'fitness.weekly_summary': {
    en: (p) => ({
      title: '📈 Weekly wrap-up',
      message: payloadCopy(p, 'summary', 'en') || 'Your workouts, nutrition, and progress — see how the week went.',
    }),
    ar: (p) => ({
      title: '📈 ملخص الأسبوع',
      message: payloadCopy(p, 'summary', 'ar') || 'تمارينك وتغذيتك وتقدمك — اطلع على أداء الأسبوع.',
    }),
  },
  'fitness.macro_target': {
    en: () => ({ title: '🎯 Macros on point', message: 'You hit your macro targets today. Nutrition dialed in.' }),
    ar: () => ({ title: '🎯 الماكرو مضبوط', message: 'حققت أهداف الماكرو اليوم. تغذيتك في المسار الصحيح.' }),
  },
  'fitness.weight_trend': {
    en: (p) => ({
      title: '⚖️ Weight trend',
      message: weightTrendMessage(p, 'en') || payloadCopy(p, 'message', 'en') || 'Your weight trend has shifted.',
    }),
    ar: (p) => ({
      title: '⚖️ اتجاه الوزن',
      message: weightTrendMessage(p, 'ar') || payloadCopy(p, 'message', 'ar') || 'اتجاه وزنك تغيّر.',
    }),
  },
  'fitness.ai_insight': {
    en: (p) => ({
      title: '🤖 Coach insight',
      message: aiInsightMessage(p, 'en') || payloadCopy(p, 'insight', 'en') || 'Your AI coach has a tip for you.',
    }),
    ar: (p) => ({
      title: '🤖 نصيحة المدرب',
      message: aiInsightMessage(p, 'ar') || payloadCopy(p, 'insight', 'ar') || 'مدربك الذكي لديه نصيحة لك.',
    }),
  },
  'fitness.coach_feedback': {
    en: (p) => ({
      title: '👥 Coach feedback',
      message: payloadCopy(p, 'message', 'en') || 'Your coach left feedback on your session.',
    }),
    ar: (p) => ({
      title: '👥 ملاحظات المدرب',
      message: payloadCopy(p, 'message', 'ar') || 'ترك مدربك ملاحظات على جلستك.',
    }),
  },
  'coach.feedback_available': {
    en: (p) => ({
      title: '🤖 Coach weekly review',
      message:
        payloadCopy(p, 'message', 'en') ||
        payloadCopy(p, 'coachMessage', 'en') ||
        'Your AI coach reviewed your week and updated your plan. See what changed.',
    }),
    ar: (p) => ({
      title: '🤖 مراجعة المدرب الأسبوعية',
      message:
        payloadCopy(p, 'message', 'ar') ||
        payloadCopy(p, 'coachMessage', 'ar') ||
        'راجع مدربك الذكي أسبوعك وحدّث خطتك. اطلع على التغييرات.',
    }),
  },
  'fitness.heart_rate_anomaly': {
    en: (p) => ({
      title: '❤️ Heart rate alert',
      message:
        payloadCopy(p, 'message', 'en') || 'We detected an elevated resting heart rate. Monitor how you feel today.',
    }),
    ar: (p) => ({
      title: '❤️ تنبيه نبض',
      message: payloadCopy(p, 'message', 'ar') || 'رصدنا ارتفاعاً في معدل نبض الراحة. راقب حالتك اليوم.',
    }),
  },
  'support.received': {
    en: (p) => ({
      title: '🛟 Support ticket received',
      message: p.subject
        ? `We got your message about "${p.subject}". Our team will reply soon.`
        : 'We received your support request and will get back to you soon.',
    }),
    ar: (p) => ({
      title: '🛟 استلمنا طلبك',
      message: p.subject
        ? `استلمنا رسالتك بخصوص "${p.subject}". سيرد فريقنا قريبًا.`
        : 'استلمنا طلب الدعم وسنرد عليك قريبًا.',
    }),
  },
  'support.reply': {
    en: (p) => ({
      title: '🛟 Support replied',
      message:
        payloadCopy(p, 'preview', 'en') ||
        payloadCopy(p, 'message', 'en') ||
        (p.subject
          ? `New reply on "${p.subject}". Tap to read the full message.`
          : 'Your support ticket has a new reply.'),
    }),
    ar: (p) => ({
      title: '🛟 رد من الدعم',
      message:
        payloadCopy(p, 'preview', 'ar') ||
        payloadCopy(p, 'message', 'ar') ||
        (p.subjectAr || p.subject
          ? `رد جديد على "${p.subjectAr || p.subject}". اضغط لقراءة الرسالة كاملة.`
          : 'تذكرتك لديها رد جديد.'),
    }),
  },
  'auth.new_device': {
    en: () => ({
      title: '🔐 New sign-in',
      message: 'We noticed a sign-in from a new device. If this wasn\'t you, secure your account in Settings.',
    }),
    ar: () => ({
      title: '🔐 تسجيل دخول جديد',
      message: 'لاحظنا تسجيل دخول من جهاز جديد. إن لم تكن أنت، أمّن حسابك من الإعدادات.',
    }),
  },
  'community.mention': {
    en: (p) => ({
      title: '📣 You were mentioned',
      message: `${p.actorName || 'Someone'} mentioned you in a post.`,
    }),
    ar: (p) => ({
      title: '📣 تم ذكرك',
      message: `ذكرك ${p.actorName || 'شخص'} في منشور.`,
    }),
  },
  'community.story_mention': {
    en: (p) => ({ title: p.actorName || 'Someone', message: `${p.actorName || 'Someone'} mentioned you in a story` }),
    ar: (p) => ({ title: p.actorName || 'شخص', message: `ذكرك ${p.actorName || 'شخص'} في قصة` }),
  },
  'community.repost': {
    en: (p) => ({ title: p.actorName || 'Someone', message: `${p.actorName || 'Someone'} reposted your post` }),
    ar: (p) => ({ title: p.actorName || 'شخص', message: `أعاد ${p.actorName || 'شخص'} نشر منشورك` }),
  },
  'community.comment_reaction': {
    en: (p) => {
      const emoji = p.emoji ? ` ${p.emoji}` : '';
      return { title: p.actorName || 'Someone', message: `${p.actorName || 'Someone'} reacted${emoji} to your comment` };
    },
    ar: (p) => {
      const emoji = p.emoji ? ` ${p.emoji}` : '';
      return { title: p.actorName || 'شخص', message: `${p.actorName || 'شخص'} تفاعل${emoji} مع تعليقك` };
    },
  },
  'community.group_join_accepted': {
    en: (p) => ({
      title: p.actorName || 'Someone',
      message: p.groupName
        ? `${p.actorName || 'Someone'} approved your request — you joined "${p.groupName}"`
        : `${p.actorName || 'Someone'} approved your request to join the group`,
    }),
    ar: (p) => ({
      title: p.actorName || 'شخص',
      message: p.groupName
        ? `وافق ${p.actorName || 'شخص'} على طلبك — انضممت إلى "${p.groupName}"`
        : `وافق ${p.actorName || 'شخص'} على طلبك للانضمام إلى المجموعة`,
    }),
  },
  'community.group_member_added': {
    en: (p) => ({
      title: p.actorName || 'Someone',
      message: p.groupName
        ? `${p.actorName || 'Someone'} added you to group "${p.groupName}"`
        : `${p.actorName || 'Someone'} added you to a group`,
    }),
    ar: (p) => ({
      title: p.actorName || 'شخص',
      message: p.groupName
        ? `أضافك ${p.actorName || 'شخص'} إلى مجموعة "${p.groupName}"`
        : `أضافك ${p.actorName || 'شخص'} إلى مجموعة`,
    }),
  },
  'community.message_request_accepted': {
    en: (p) => ({ title: p.actorName || 'Someone', message: `${p.actorName || 'Someone'} accepted your message request` }),
    ar: (p) => ({ title: p.actorName || 'شخص', message: `قبل ${p.actorName || 'شخص'} طلب مراسلتك` }),
  },
  'order.placed': {
    en: (p) => {
      if (p.variant === 'confirmed') {
        return {
          title: '📦 Order confirmed',
          message: `Your order of ${p.total} ${p.currency} is confirmed. We'll keep you updated.`,
        };
      }
      if (p.variant === 'cod') {
        return {
          title: '📦 Order received',
          message: `COD order (${p.total} ${p.currency}) is pending. We'll call you at ${p.phone} to confirm.`,
        };
      }
      return {
        title: '💳 Complete payment',
        message: `Pay ${p.total} ${p.currency} to confirm your order.`,
      };
    },
    ar: (p) => {
      if (p.variant === 'confirmed') {
        return { title: '📦 تم تأكيد الطلب', message: `طلبك بقيمة ${p.total} ${p.currency} مؤكد. سنُبقيك على اطلاع.` };
      }
      if (p.variant === 'cod') {
        return {
          title: '📦 تم استلام الطلب',
          message: `طلب الدفع عند الاستلام (${p.total} ${p.currency}) قيد التأكيد. سنتواصل على ${p.phone}.`,
        };
      }
      return {
        title: '💳 أكمل الدفع',
        message: `ادفع ${p.total} ${p.currency} لتأكيد طلبك.`,
      };
    },
  },
  'order.confirmed': {
    en: (p) => ({
      title: 'Order confirmed',
      message: p.shortId
        ? `Payment received. Your order #${p.shortId} is confirmed.`
        : 'Payment received. Your order is confirmed.',
    }),
    ar: (p) => ({
      title: 'تم تأكيد الطلب',
      message: p.shortId ? `تم استلام الدفع. طلبك #${p.shortId} مؤكد.` : 'تم استلام الدفع وتأكيد طلبك.',
    }),
  },
  'order.refunded': {
    en: (p) => ({
      title: p.provider === 'stripe' ? 'Stripe payment refunded' : 'Payment refunded',
      message:
        p.provider === 'stripe'
          ? `Test payment for order #${p.shortId} was charged and automatically refunded.`
          : `Demo payment for order #${p.shortId} was automatically refunded. No real charge was kept.`,
    }),
    ar: (p) => ({
      title: 'تم استرداد الدفع',
      message: `تم استرداد دفع الطلب #${p.shortId} تلقائيًا.`,
    }),
  },
  'order.paid': {
    en: (p) => ({
      title: 'Payment received',
      message: `Your payment of ${p.total} ${p.currency || 'EGP'} was successful. Order is confirmed.`,
    }),
    ar: (p) => ({
      title: 'تم استلام الدفع',
      message: `تم استلام دفعتك (${p.total} ${p.currency || 'ج.م'}) بنجاح. الطلب مؤكد.`,
    }),
  },
  'order.shipped': {
    en: (p) => ({
      title: '🚚 On the way',
      message: p.shortId
        ? `Order #${p.shortId} has shipped. Track it in your orders.`
        : 'Your order has shipped and is on its way to you.',
    }),
    ar: (p) => ({
      title: '🚚 في الطريق',
      message: p.shortId ? `طلب #${p.shortId} تم شحنه. تتبّعه من طلباتك.` : 'طلبك في الطريق إليك.',
    }),
  },
  'order.delivered': {
    en: () => ({ title: '✅ Delivered', message: 'Your order was delivered. Enjoy!' }),
    ar: () => ({ title: '✅ تم التسليم', message: 'وصل طلبك. بالهناء والشفاء!' }),
  },
  'order.cancelled': {
    en: () => ({ title: '❌ Order cancelled', message: 'Your order was cancelled. Reorder anytime from the shop.' }),
    ar: () => ({ title: '❌ تم الإلغاء', message: 'تم إلغاء طلبك. يمكنك إعادة الطلب من المتجر.' }),
  },
  'order.awaiting_payment': {
    en: (p) => ({
      title: '💳 Payment needed',
      message: `Complete payment (${p.total} ${p.currency || 'EGP'}) to confirm your order.`,
    }),
    ar: (p) => ({
      title: '💳 مطلوب الدفع',
      message: `أكمل الدفع (${p.total} ${p.currency || 'ج.م'}) لتأكيد طلبك.`,
    }),
  },
  'order.subscription_due': {
    en: (p) => ({
      title: 'Subscription delivery due',
      message: `Your ${p.productName || 'subscription'} is ready to reorder.`,
    }),
    ar: (p) => ({
      title: 'موعد تجديد الاشتراك',
      message: `حان وقت إعادة طلب ${p.productName || 'اشتراكك'}.`,
    }),
  },
  'order.reorder_reminder': {
    en: (p) => ({
      title: 'Time to restock?',
      message: `You may be running low on ${p.productName || 'a product'}. Reorder in one tap.`,
    }),
    ar: (p) => ({
      title: 'حان وقت إعادة الطلب؟',
      message: `قد يكون مخزون ${p.productName || 'المنتج'} منخفضًا. أعد الطلب بنقرة واحدة.`,
    }),
  },
  'promo.referral_reward': {
    en: (p) => ({
      title: 'Referral reward!',
      message: `You earned ${p.points} points — your friend placed their first order.`,
    }),
    ar: (p) => ({
      title: 'مكافأة إحالة!',
      message: `حصلت على ${p.points} نقطة — صديقك قدّم أول طلب.`,
    }),
  },
  'gamification.league.promoted': {
    en: (p) => ({
      title: 'League promotion!',
      message: `You moved up to ${tierLabel(p.tier, 'en')} league. Keep your weekly score strong.`,
    }),
    ar: (p) => ({
      title: 'ترقية في الدوري!',
      message: `ارتقيت إلى دوري ${tierLabel(p.tier, 'ar')}. حافظ على نقاطك الأسبوعية.`,
    }),
  },
  'gamification.league.demoted': {
    en: (p) => ({
      title: 'League update',
      message: `You moved to ${tierLabel(p.tier, 'en')} league this week. Log more days to climb back.`,
    }),
    ar: (p) => ({
      title: 'تحديث الدوري',
      message: `انتقلت إلى دوري ${tierLabel(p.tier, 'ar')} هذا الأسبوع. سجّل المزيد من الأيام للعودة.`,
    }),
  },
  'gamification.league.top10': {
    en: () => ({
      title: 'Top 10 in your league',
      message: 'You finished in the top 10 of your tier this week. Bonus XP awarded.',
    }),
    ar: () => ({
      title: 'أفضل 10 في دوريك',
      message: 'أنهيت ضمن أفضل 10 في مستواك هذا الأسبوع. تم منح نقاط XP إضافية.',
    }),
  },
  'gamification.challenge.completed': {
    en: (p) => ({
      title: '🏅 Challenge complete!',
      message: `"${p.title}" done — +${p.xp} XP and a new badge unlocked.`,
    }),
    ar: (p) => ({
      title: '🏅 اكتمل التحدي!',
      message: `أنهيت "${p.title}" — +${p.xp} نقطة وشارة جديدة.`,
    }),
  },
  'gamification.duel.invited': {
    en: (p) => ({
      title: 'Duel challenge!',
      message: `${p.name} challenged you to "${p.title}".`,
    }),
    ar: (p) => ({
      title: 'تحدي مواجهة!',
      message: `${p.name} تحداك في "${p.title}".`,
    }),
  },
  'gamification.duel.accepted': {
    en: (p) => ({
      title: 'Duel accepted',
      message: `${p.name} accepted your "${p.title}" duel.`,
    }),
    ar: (p) => ({
      title: 'قُبل التحدي',
      message: `${p.name} قبل تحدي "${p.title}".`,
    }),
  },
  'gamification.duel.won': {
    en: (p) => ({
      title: '⚔️ Duel victory!',
      message: `You won "${p.title}" — +${p.xp} XP. Nice work.`,
    }),
    ar: (p) => ({
      title: '⚔️ فوز في المواجهة!',
      message: `فزت في "${p.title}" — +${p.xp} نقطة. أحسنت.`,
    }),
  },
  'gamification.duel.lost': {
    en: (p) => ({
      title: 'Duel result',
      message: `${p.name} won "${p.title}" this round. Rematch?`,
    }),
    ar: (p) => ({
      title: 'نتيجة المواجهة',
      message: `${p.name} فاز في "${p.title}". جولة أخرى؟`,
    }),
  },
  'gamification.duel.tie': {
    en: (p) => ({
      title: 'Duel tied!',
      message: `"${p.title}" ended in a tie — bonus XP for both.`,
    }),
    ar: (p) => ({
      title: 'تعادل!',
      message: `"${p.title}" انتهى بالتعادل — نقاط إضافية للطرفين.`,
    }),
  },
  'gamification.squad.joined': {
    en: (p) => ({
      title: 'Squad member joined',
      message: `${p.name} joined your "${p.title}" squad.`,
    }),
    ar: (p) => ({
      title: 'انضم عضو للفريق',
      message: `${p.name} انضم لفريق "${p.title}".`,
    }),
  },
  'gamification.squad.started': {
    en: (p) => ({
      title: 'Squad challenge started',
      message: `"${p.name}" is now active — average progress counts.`,
    }),
    ar: (p) => ({
      title: 'بدأ تحدي الفريق',
      message: `"${p.name}" أصبح نشطًا — يُحسب متوسط التقدّم.`,
    }),
  },
  'gamification.squad.completed': {
    en: (p) => ({
      title: 'Squad goal reached!',
      message: `"${p.title}" squad hit ${p.avg}% avg — +${p.xp} XP each.`,
    }),
    ar: (p) => ({
      title: 'حقق الفريق الهدف!',
      message: `فريق "${p.title}" وصل ${p.avg}% — +${p.xp} نقطة لكل عضو.`,
    }),
  },
  'ai.plan_change': {
    en: (p) => {
      const via = p.triggeredBy === 'chat' ? 'chat' : 'your manual edit';
      let message = `Recorded a ${p.changeType || 'edit'} via ${via}. Your plan will align at the weekly review.`;
      if (p.reason?.trim()) message += ` ${p.reason.trim().slice(0, 120)}`;
      return { title: 'Plan updated', message };
    },
    ar: (p) => {
      const via = p.triggeredBy === 'chat' ? 'المحادثة' : 'تعديلك اليدوي';
      let message = `سجّلنا تعديلاً (${p.changeType || 'edit'}) عبر ${via}. الخطة ستتزامن مع مراجعتك الأسبوعية.`;
      if (p.reason?.trim()) message += ` ${p.reason.trim().slice(0, 120)}`;
      return { title: 'تعديل على خطتك', message };
    },
  },
  'ai.weekly_review': {
    en: () => ({
      title: '📋 Weekly check-in',
      message: 'Log your weight, readiness, and feedback so your coach can plan next week.',
    }),
    ar: () => ({
      title: '📋 مراجعة أسبوعية',
      message: 'سجّل وزنك وجاهزيتك وتقييمك ليخطط مدربك للأسبوع القادم.',
    }),
  },
  'ai.adaptation_macro': {
    en: () => ({
      title: '🥗 New nutrition plan',
      message: 'Your coach suggested updated macro targets. Review and confirm in your dashboard.',
    }),
    ar: () => ({
      title: '🥗 خطة تغذية جديدة',
      message: 'اقترح مدربك أهداف ماكرو محدّثة. راجعها وأكّدها من لوحة التحكم.',
    }),
  },
  'ai.adaptation_applied': {
    en: (p) => {
      const decision = adaptationDecisionLabel(p.decision, 'en');
      let message = `Your coach reviewed this week and recommends ${decision}.`;
      if (p.reason?.trim()) message += `\n\n${p.reason.trim().slice(0, 180)}`;
      return { title: '🤖 Plan updated', message };
    },
    ar: (p) => {
      const decision = adaptationDecisionLabel(p.decision, 'ar');
      let message = `راجع مدربك هذا الأسبوع ويوصي بـ${decision}.`;
      if (p.reason?.trim()) message += `\n\n${p.reason.trim().slice(0, 180)}`;
      return { title: '🤖 تحديث الخطة', message };
    },
  },
  'gym.checkin': {
    en: (p) => ({
      title: p.forOwner ? 'New check-in' : 'Checked in',
      message: p.forOwner
        ? `A member just checked in to ${p.gymName || 'your gym'}.`
        : `You checked in at ${p.gymName || 'the gym'}.`,
    }),
    ar: (p) => ({
      title: p.forOwner ? 'تسجيل دخول جديد' : 'تم تسجيل الدخول',
      message: p.forOwner
        ? `سجّل عضو دخوله إلى ${p.gymName || 'صالتك'}.`
        : `سجّلت دخولك في ${p.gymName || 'الصالة'}.`,
    }),
  },
  'gym.membership': {
    en: (p) => ({
      title: p.accountCreated ? `Welcome to ${p.gymName || 'the gym'}` : `You joined ${p.gymName || 'the gym'}`,
      message: p.accountCreated
        ? `You were registered at ${p.gymName || 'the gym'}. Use "Forgot password" with your email to set a login password.`
        : `Your membership at ${p.gymName || 'the gym'} is now active.`,
    }),
    ar: (p) => ({
      title: p.accountCreated ? `مرحبًا بك في ${p.gymName || 'الصالة'}` : `انضممت إلى ${p.gymName || 'الصالة'}`,
      message: p.accountCreated
        ? `تم تسجيلك في ${p.gymName || 'الصالة'}. استخدم "نسيت كلمة المرور" لتعيين كلمة مرور.`
        : `عضويتك في ${p.gymName || 'الصالة'} أصبحت نشطة.`,
    }),
  },
  'gym.class': {
    en: (p) => ({
      title: p.accountCreated
        ? `Class booked at ${p.gymName || 'the gym'}`
        : p.sessionLabel
          ? 'Session confirmed'
          : 'Class booked',
      message: p.accountCreated
        ? `You were registered and booked for ${p.sessionLabel || p.classLabel}. Use "Forgot password" to set your login.`
        : p.sessionDate
          ? `You are booked for ${p.classLabel || p.sessionLabel} on ${p.sessionDate} at ${p.gymName || 'the gym'}.`
          : `You are booked for ${p.sessionLabel || p.classLabel} at ${p.gymName || 'the gym'}.`,
    }),
    ar: (p) => ({
      title: p.accountCreated ? `حجز في ${p.gymName || 'الصالة'}` : 'تم تأكيد الحجز',
      message: p.accountCreated
        ? `تم تسجيلك وحجزك لـ ${p.sessionLabel || p.classLabel}. استخدم "نسيت كلمة المرور" لتعيين كلمة المرور.`
        : p.sessionDate
          ? `حجزت ${p.classLabel || p.sessionLabel} في ${p.sessionDate} — ${p.gymName || 'الصالة'}.`
          : `تم حجزك لـ ${p.sessionLabel || p.classLabel} في ${p.gymName || 'الصالة'}.`,
    }),
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
