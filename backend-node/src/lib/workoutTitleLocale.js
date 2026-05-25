/**
 * Workout session titles — locale-aware display (reuse food/exercise translators).
 */
const { translateExerciseNameEnToAr, hasArabic: hasArabicExercise } = require('./exerciseNameAr');
const { translateFoodNameArToEn } = require('./webtebFoodNameEn');

/**
 * @param {string|null|undefined} title
 * @param {'ar'|'en'} locale
 */
async function resolveWorkoutDisplayTitle(title, locale = 'ar') {
  const raw = String(title || '').trim();
  if (!raw) return locale === 'ar' ? 'تمرين' : 'Workout';

  if (locale === 'ar') {
    if (hasArabicExercise(raw)) return raw;
    return (await translateExerciseNameEnToAr(raw, { delayMs: 0 })) || raw;
  }

  if (!hasArabicExercise(raw)) return raw;
  return (await translateFoodNameArToEn(raw, { delayMs: 0 })) || raw;
}

module.exports = {
  resolveWorkoutDisplayTitle,
};
