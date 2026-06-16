const CHALLENGE_TITLE = {
  en: {
    'workout-7': 'Consistency Week',
    'hydration-7': 'Hydration Week',
    'nutrition-14': 'Log Your Meals',
    'score-7': 'Score Builder',
    'gym-30': 'Gym Regular',
    'streak-7': 'Keep the Streak',
  },
  ar: {
    'workout-7': 'أسبوع الالتزام',
    'hydration-7': 'أسبوع الترطيب',
    'nutrition-14': 'سجّل وجباتك',
    'score-7': 'بناء النقاط',
    'gym-30': 'منتظم النادي',
    'streak-7': 'حافظ على السلسلة',
  },
};

function challengeTitleForUser(slug, language) {
  const lang = language === 'ar' ? 'ar' : 'en';
  return CHALLENGE_TITLE[lang][slug] || slug;
}

module.exports = { challengeTitleForUser, CHALLENGE_TITLE };
