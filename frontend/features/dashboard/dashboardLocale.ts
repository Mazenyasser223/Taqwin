import type { AppLanguage } from '../../services/settingsService';
import type { TranslationKey } from '../../lib/i18n/translations';
import { localizeOnboardingDisplayValue } from '../onboarding/localizeOnboardingDisplay';

const EN_DAY_TO_KEY: Record<string, TranslationKey> = {
  sun: 'common.daySun',
  sunday: 'common.daySun',
  mon: 'common.dayMon',
  monday: 'common.dayMon',
  tue: 'common.dayTue',
  tuesday: 'common.dayTue',
  wed: 'common.dayWed',
  wednesday: 'common.dayWed',
  thu: 'common.dayThu',
  thursday: 'common.dayThu',
  fri: 'common.dayFri',
  friday: 'common.dayFri',
  sat: 'common.daySat',
  saturday: 'common.daySat',
};

const RADAR_CATEGORY_KEYS: Record<string, TranslationKey> = {
  workout: 'dashboard.radarWorkout',
  calories: 'dashboard.radarCalories',
  protein: 'dashboard.radarProtein',
  activity: 'dashboard.radarActivity',
  consistency: 'dashboard.radarConsistency',
};

export function localeTag(language: AppLanguage): string {
  return language === 'ar' ? 'ar-EG' : 'en-US';
}

export function formatWeekdayLabel(
  dayOrDate: string,
  language: AppLanguage,
  t: (key: TranslationKey) => string,
  short = true,
): string {
  const key = EN_DAY_TO_KEY[dayOrDate.trim().toLowerCase()];
  if (key) {
    const label = t(key);
    return short && label.length > 3 ? label.slice(0, 3) : label;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dayOrDate)) {
    const d = new Date(`${dayOrDate}T12:00:00Z`);
    const weekday = d.toLocaleDateString(localeTag(language), { weekday: short ? 'short' : 'long' });
    return short && weekday.length > 4 ? weekday.slice(0, 3) : weekday;
  }

  return dayOrDate.slice(0, short ? 3 : undefined);
}

export function formatFitnessLevel(
  level: string | null | undefined,
  language: AppLanguage,
  t: (key: TranslationKey) => string,
): string {
  if (!level) return t('dashboard.levelIntermediate');
  const localized = localizeOnboardingDisplayValue('fitnessLevel', level, language);
  if (localized !== level) return localized;
  const norm = level.toLowerCase();
  if (norm.includes('begin')) return t('dashboard.levelBeginner');
  if (norm.includes('advanc')) return t('dashboard.levelAdvanced');
  if (norm.includes('inter')) return t('dashboard.levelIntermediate');
  return localized;
}

export function localizeActivityType(
  type: string,
  t: (key: TranslationKey) => string,
): string {
  if (type === 'workout') return t('dashboard.activityTypeWorkout');
  if (type === 'food') return t('dashboard.activityTypeFood');
  return type;
}

export function localizeBookingStatus(
  status: string,
  t: (key: TranslationKey) => string,
): string {
  const s = status.toLowerCase();
  if (s === 'pending') return t('dashboard.bookingPending');
  if (s === 'confirmed') return t('dashboard.bookingConfirmed');
  if (s === 'cancelled' || s === 'canceled') return t('dashboard.bookingCancelled');
  return status;
}

export function localizeRadarCategory(
  category: string,
  t: (key: TranslationKey) => string,
): string {
  const key = RADAR_CATEGORY_KEYS[category.trim().toLowerCase()];
  return key ? t(key) : category;
}

export function formatMinutesShort(
  minutes: number,
  t: (key: TranslationKey) => string,
): string {
  return `${minutes} ${t('dashboard.minShort')}`;
}

export function formatTimelineSubtitle(
  subtitle: string,
  language: AppLanguage,
  t: (key: TranslationKey) => string,
): string {
  const minMatch = subtitle.match(/^(\d+)\s*(min|د)$/i);
  if (minMatch) return formatMinutesShort(Number(minMatch[1]), t);

  const kcalMatch = subtitle.match(/^(\d+)\s*(kcal|سعرة)$/i);
  if (kcalMatch) {
    return `${kcalMatch[1]} ${t('dashboard.chartKcal')}`;
  }

  return subtitle;
}

export function localizeTimelineTitle(
  title: string,
  type: string,
  t: (key: TranslationKey) => string,
): string {
  if (title === 'Meal') return t('dashboard.timelineMeal');
  if (title === 'Workout') return t('dashboard.timelineWorkout');
  if (type === 'workout') return title;
  return title;
}
