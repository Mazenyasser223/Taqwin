/**
 * Gamification in-app notifications (league + challenges).
 */
const { emitNotification } = require('../notifications');
const { getOrCreateUserSettings } = require('../userSettings');

const COPY = {
  'gamification.league.promoted': {
    en: {
      title: 'League promotion!',
      message: (p) => `You moved up to ${p.tier} league. Keep your weekly score strong.`,
    },
    ar: {
      title: 'ترقية في الدوري!',
      message: (p) => `ارتقيت إلى دوري ${p.tier}. حافظ على نقاطك الأسبوعية.`,
    },
  },
  'gamification.league.demoted': {
    en: {
      title: 'League update',
      message: (p) => `You moved to ${p.tier} league this week. Log more days to climb back.`,
    },
    ar: {
      title: 'تحديث الدوري',
      message: (p) => `انتقلت إلى دوري ${p.tier} هذا الأسبوع. سجّل المزيد من الأيام للعودة.`,
    },
  },
  'gamification.league.top10': {
    en: {
      title: 'Top 10 in your league',
      message: () => 'You finished in the top 10 of your tier this week. Bonus XP awarded.',
    },
    ar: {
      title: 'أفضل 10 في دوريك',
      message: () => 'أنهيت ضمن أفضل 10 في مستواك هذا الأسبوع. تم منح نقاط XP إضافية.',
    },
  },
  'gamification.challenge.completed': {
    en: {
      title: 'Challenge complete!',
      message: (p) => `"${p.title}" finished — +${p.xp} XP and a new badge.`,
    },
    ar: {
      title: 'اكتمل التحدي!',
      message: (p) => `انتهى "${p.title}" — +${p.xp} نقطة وشارة جديدة.`,
    },
  },
  'gamification.duel.invited': {
    en: {
      title: 'Duel challenge!',
      message: (p) => `${p.name} challenged you to "${p.title}".`,
    },
    ar: {
      title: 'تحدي مواجهة!',
      message: (p) => `${p.name} تحداك في "${p.title}".`,
    },
  },
  'gamification.duel.accepted': {
    en: {
      title: 'Duel accepted',
      message: (p) => `${p.name} accepted your "${p.title}" duel.`,
    },
    ar: {
      title: 'قُبل التحدي',
      message: (p) => `${p.name} قبل تحدي "${p.title}".`,
    },
  },
  'gamification.duel.won': {
    en: {
      title: 'You won the duel!',
      message: (p) => `"${p.title}" — +${p.xp} XP. Higher progress wins.`,
    },
    ar: {
      title: 'فزت في المواجهة!',
      message: (p) => `"${p.title}" — +${p.xp} نقطة. الأعلى تقدّمًا يفوز.`,
    },
  },
  'gamification.duel.lost': {
    en: {
      title: 'Duel result',
      message: (p) => `${p.name} won "${p.title}" this round. Rematch?`,
    },
    ar: {
      title: 'نتيجة المواجهة',
      message: (p) => `${p.name} فاز في "${p.title}". جولة أخرى؟`,
    },
  },
  'gamification.duel.tie': {
    en: {
      title: 'Duel tied!',
      message: (p) => `"${p.title}" ended in a tie — bonus XP for both.`,
    },
    ar: {
      title: 'تعادل!',
      message: (p) => `"${p.title}" انتهى بالتعادل — نقاط إضافية للطرفين.`,
    },
  },
  'gamification.squad.joined': {
    en: {
      title: 'Squad member joined',
      message: (p) => `${p.name} joined your "${p.title}" squad.`,
    },
    ar: {
      title: 'انضم عضو للفريق',
      message: (p) => `${p.name} انضم لفريق "${p.title}".`,
    },
  },
  'gamification.squad.started': {
    en: {
      title: 'Squad challenge started',
      message: (p) => `"${p.name}" is now active — average progress counts.`,
    },
    ar: {
      title: 'بدأ تحدي الفريق',
      message: (p) => `"${p.name}" أصبح نشطًا — يُحسب متوسط التقدّم.`,
    },
  },
  'gamification.squad.completed': {
    en: {
      title: 'Squad goal reached!',
      message: (p) => `"${p.title}" squad hit ${p.avg}% avg — +${p.xp} XP each.`,
    },
    ar: {
      title: 'حقق الفريق الهدف!',
      message: (p) => `فريق "${p.title}" وصل ${p.avg}% — +${p.xp} نقطة لكل عضو.`,
    },
  },
};

function tierLabel(tier, lang) {
  const labels = {
    en: { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', diamond: 'Diamond' },
    ar: { bronze: 'برونزي', silver: 'فضي', gold: 'ذهبي', diamond: 'ماسي' },
  };
  return labels[lang]?.[tier] ?? tier;
}

async function emitGamificationNotification({ userId, type, params = {}, link = null }) {
  const copy = COPY[type];
  if (!copy || !userId) return null;

  const settings = await getOrCreateUserSettings(userId);
  if (type.startsWith('gamification.league.') && !settings.leagueOptIn) return null;
  if (type.startsWith('gamification.challenge.') && settings.challengeNotifications === false) {
    return null;
  }
  if (
    (type.startsWith('gamification.duel.') || type.startsWith('gamification.squad.')) &&
    settings.challengeNotifications === false
  ) {
    return null;
  }

  const lang = settings.language === 'ar' ? 'ar' : 'en';
  const localized = copy[lang] || copy.en;
  const payload = { ...params };
  if (payload.tier) payload.tier = tierLabel(payload.tier, lang);

  return emitNotification({
    userId,
    type,
    title: localized.title,
    message: localized.message(payload),
    link,
    payload,
    icon: 'emoji_events',
  });
}

module.exports = {
  emitGamificationNotification,
};
