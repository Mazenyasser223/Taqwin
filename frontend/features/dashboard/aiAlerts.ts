import type { TranslationKey } from '../../lib/i18n/translations';
import type {
  AthleteHomeDashboard,
  DashboardAiAlert,
  DashboardAiAlertsPayload,
  DashboardAlertCategory,
  DashboardAlertPriority,
} from '../../services/dashboardService';

export const DASHBOARD_ALERT_I18N: Record<string, TranslationKey> = {
  protein: 'dashboard.recProtein',
  cardio: 'dashboard.recCardio',
  caloriesUp: 'dashboard.recCaloriesUp',
  caloriesDown: 'dashboard.recCaloriesDown',
  training: 'dashboard.recTraining',
  logMeals: 'dashboard.recLogMeals',
  todayWorkout: 'dashboard.recTodayWorkout',
  sleepRecovery: 'dashboard.recSleepRecovery',
  sleepWellness: 'dashboard.recSleepWellness',
  hydration: 'dashboard.recHydration',
  trainSafe: 'dashboard.recTrainSafe',
};

const NUTRITION_ALERT_KEYS = new Set(['protein', 'caloriesUp', 'caloriesDown', 'logMeals']);
const WORKOUT_ALERT_KEYS = new Set(['cardio', 'training', 'todayWorkout', 'trainSafe']);
const HEALTH_ALERT_KEYS = new Set(['sleepRecovery', 'sleepWellness', 'hydration']);

type LegacyRecommendation = {
  key: string;
  category?: DashboardAlertCategory;
  params?: Record<string, string>;
};

function alertCategory(rec: LegacyRecommendation): DashboardAlertCategory {
  if (rec.category === 'nutrition' || rec.category === 'workout' || rec.category === 'health') {
    return rec.category;
  }
  if (NUTRITION_ALERT_KEYS.has(rec.key)) return 'nutrition';
  if (WORKOUT_ALERT_KEYS.has(rec.key)) return 'workout';
  if (HEALTH_ALERT_KEYS.has(rec.key)) return 'health';
  return 'nutrition';
}

function ruleAlert(
  id: string,
  category: DashboardAlertCategory,
  key: string,
  params?: Record<string, string>,
  priority: DashboardAlertPriority = 'medium',
  link?: string | null
): DashboardAiAlert {
  return {
    id,
    category,
    source: 'rule',
    priority,
    key,
    params,
    createdAt: new Date().toISOString(),
    link: link ?? null,
  };
}

function emptyHealthFallback(): DashboardAiAlert[] {
  return [
    ruleAlert('health-hydration', 'health', 'hydration', { target: '2500' }, 'low', '/profile'),
    ruleAlert('health-sleep', 'health', 'sleepWellness', undefined, 'low', '/profile'),
  ];
}

/** Client-side fallback when API has not yet returned structured aiAlerts. */
export function buildRuleBasedAiAlerts(data: AthleteHomeDashboard): DashboardAiAlertsPayload {
  const nutrition: DashboardAiAlert[] = [];
  const workout: DashboardAiAlert[] = [];
  const health: DashboardAiAlert[] = [];
  const goal = String(data.profile.fitnessGoal || data.personalization?.goal || '').toLowerCase();
  const proteinTarget = Math.round(data.targets.proteinTarget);
  const proteinToday = Math.round(data.today.nutrition.protein);
  const plannedDays = data.personalization?.trainingDaysPerWeek ?? 4;
  const waterTarget = String(data.personalization?.waterTargetMl ?? 2500);

  if (proteinToday < proteinTarget * 0.75) {
    nutrition.push(
      ruleAlert('nutrition-protein', 'nutrition', 'protein', { target: String(proteinTarget) }, 'high', '/nutrition')
    );
  }

  const workoutDays = data.weekly.filter((d) => d.workouts > 0).length;
  if (workoutDays < plannedDays) {
    workout.push(ruleAlert('workout-cardio', 'workout', 'cardio', undefined, 'medium', '/workouts'));
  }

  const calorieGap = data.targets.calorieTarget - data.today.nutrition.calories;
  if (goal.includes('muscle') || goal.includes('gain')) {
    if (calorieGap > 200) nutrition.push(ruleAlert('nutrition-cal-up', 'nutrition', 'caloriesUp', undefined, 'medium', '/nutrition'));
  } else if (goal.includes('lose') || goal.includes('fat')) {
    if (data.today.nutrition.calories > data.targets.calorieTarget * 1.08) {
      nutrition.push(ruleAlert('nutrition-cal-down', 'nutrition', 'caloriesDown', undefined, 'high', '/nutrition'));
    }
  } else if (calorieGap > 250) {
    nutrition.push(ruleAlert('nutrition-cal-up', 'nutrition', 'caloriesUp', undefined, 'medium', '/nutrition'));
  }

  if (personalizationSleepLow(data)) {
    health.push(
      ruleAlert(
        'health-sleep-alert',
        'health',
        'sleepRecovery',
        { goal: data.personalization?.goalLabel || data.profile.fitnessGoal || 'your fitness' },
        'high',
        '/profile'
      )
    );
  } else {
    health.push(ruleAlert('health-sleep', 'health', 'sleepWellness', undefined, 'low', '/profile'));
  }

  health.push(ruleAlert('health-hydration', 'health', 'hydration', { target: waterTarget }, 'low', '/profile'));

  if (workout.length < 2 && data.totals.workouts < plannedDays) {
    workout.push(ruleAlert('workout-training', 'workout', 'training', undefined, 'medium', '/workouts'));
  }
  if (nutrition.length < 2 && data.today.nutrition.logCount === 0) {
    nutrition.push(ruleAlert('nutrition-log-meals', 'nutrition', 'logMeals', undefined, 'high', '/nutrition'));
  }
  if (workout.length < 2 && data.today.workouts.length === 0) {
    workout.push(ruleAlert('workout-today', 'workout', 'todayWorkout', undefined, 'high', '/workouts'));
  }

  const injuries = data.personalization?.injuries ?? [];
  if (injuries.length) {
    workout.push(
      ruleAlert('workout-injury', 'workout', 'trainSafe', { area: injuries[0] }, 'high', '/workouts')
    );
  }

  if (!nutrition.length) {
    nutrition.push(ruleAlert('nutrition-default', 'nutrition', 'logMeals', undefined, 'low', '/nutrition'));
  }
  if (!workout.length) {
    workout.push(ruleAlert('workout-default', 'workout', 'todayWorkout', undefined, 'low', '/workouts'));
  }

  return {
    nutrition: nutrition.slice(0, 2),
    workout: workout.slice(0, 2),
    health: health.length ? health.slice(0, 2) : emptyHealthFallback(),
    generatedAt: new Date().toISOString(),
    source: 'rule',
  };
}

function personalizationSleepLow(data: AthleteHomeDashboard): boolean {
  const sleep = data.personalization?.sleepLabel || data.personalization?.sleep || '';
  return String(sleep).includes('5');
}

function legacyToAlert(rec: LegacyRecommendation, index: number): DashboardAiAlert {
  const category = alertCategory(rec);
  const link = category === 'nutrition' ? '/nutrition' : category === 'workout' ? '/workouts' : '/profile';
  return {
    id: `legacy-${category}-${rec.key}-${index}`,
    category,
    source: 'rule',
    priority: 'medium',
    key: rec.key,
    params: rec.params,
    createdAt: new Date().toISOString(),
    link,
  };
}

function partitionLegacy(recommendations: LegacyRecommendation[]): DashboardAiAlertsPayload {
  const nutrition: DashboardAiAlert[] = [];
  const workout: DashboardAiAlert[] = [];
  const health: DashboardAiAlert[] = [];
  recommendations.forEach((rec, i) => {
    const alert = legacyToAlert(rec, i);
    if (alert.category === 'workout') workout.push(alert);
    else if (alert.category === 'health') health.push(alert);
    else nutrition.push(alert);
  });
  return {
    nutrition: nutrition.length ? nutrition.slice(0, 2) : [legacyToAlert({ key: 'logMeals', category: 'nutrition' }, 0)],
    workout: workout.length ? workout.slice(0, 2) : [legacyToAlert({ key: 'todayWorkout', category: 'workout' }, 0)],
    health: health.length ? health.slice(0, 2) : emptyHealthFallback(),
    generatedAt: new Date().toISOString(),
    source: 'rule',
  };
}

function normalizeAiAlertsPayload(payload: DashboardAiAlertsPayload): DashboardAiAlertsPayload {
  return {
    nutrition: payload.nutrition ?? [],
    workout: payload.workout ?? [],
    health: payload.health?.length ? payload.health : emptyHealthFallback(),
    generatedAt: payload.generatedAt,
    source: payload.source,
  };
}

/** Prefer structured `aiAlerts` from API; fall back to legacy recommendations or rules. */
export function resolveDashboardAiAlerts(data: AthleteHomeDashboard): DashboardAiAlertsPayload {
  if (data.aiAlerts?.nutrition?.length || data.aiAlerts?.workout?.length || data.aiAlerts?.health?.length) {
    return normalizeAiAlertsPayload(data.aiAlerts);
  }
  const legacy = data.aiRecommendations;
  if (legacy?.length) return partitionLegacy(legacy);
  return buildRuleBasedAiAlerts(data);
}

export function isDashboardAlertCritical(alert: DashboardAiAlert): boolean {
  return alert.priority === 'high';
}

export function formatDashboardAlertText(
  alert: DashboardAiAlert,
  t: (key: TranslationKey, params?: Record<string, string>) => string
): string {
  if (alert.source === 'ai' && alert.message?.trim()) return alert.message.trim();
  if (alert.key) {
    const i18nKey = DASHBOARD_ALERT_I18N[alert.key];
    if (i18nKey) return t(i18nKey, alert.params);
  }
  return alert.message?.trim() || alert.key || '';
}

const AI_SUMMARY_READ_PREFIX = 'taqwin-ai-summary-read';

export function aiSummaryReadStorageKey(userId: string, generatedAt: string): string {
  return `${AI_SUMMARY_READ_PREFIX}:${userId}:${generatedAt}`;
}

export function isAiSummaryMarkedRead(userId: string | undefined, generatedAt: string): boolean {
  if (!userId || !generatedAt) return false;
  try {
    return localStorage.getItem(aiSummaryReadStorageKey(userId, generatedAt)) === '1';
  } catch {
    return false;
  }
}

export function markAiSummaryAsRead(userId: string | undefined, generatedAt: string): void {
  if (!userId || !generatedAt) return;
  try {
    localStorage.setItem(aiSummaryReadStorageKey(userId, generatedAt), '1');
  } catch {
    /* ignore quota / private mode */
  }
}

export function unmarkAiSummaryAsRead(userId: string | undefined, generatedAt: string): void {
  if (!userId || !generatedAt) return;
  try {
    localStorage.removeItem(aiSummaryReadStorageKey(userId, generatedAt));
  } catch {
    /* ignore */
  }
}

export function toggleAiSummaryMarkedRead(
  userId: string | undefined,
  generatedAt: string
): boolean {
  const next = !isAiSummaryMarkedRead(userId, generatedAt);
  if (next) markAiSummaryAsRead(userId, generatedAt);
  else unmarkAiSummaryAsRead(userId, generatedAt);
  return next;
}
