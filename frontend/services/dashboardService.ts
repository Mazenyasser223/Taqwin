import apiClient, { ApiResponse } from './api';

export type DashboardAlertSource = 'rule' | 'ai';
export type DashboardAlertCategory = 'nutrition' | 'workout' | 'health';
export type DashboardAlertPriority = 'low' | 'medium' | 'high';

/** Structured alert — rule templates today; AI can set source/message for real-time coach output. */
export type DashboardAiAlert = {
  id: string;
  category: DashboardAlertCategory;
  source: DashboardAlertSource;
  priority: DashboardAlertPriority;
  key?: string | null;
  params?: Record<string, string>;
  message?: string | null;
  createdAt: string;
  link?: string | null;
};

export type DashboardAiAlertsPayload = {
  nutrition: DashboardAiAlert[];
  workout: DashboardAiAlert[];
  health: DashboardAiAlert[];
  generatedAt: string;
  source: DashboardAlertSource | 'mixed';
};

export interface AthleteWeeklyBucket {
  date: string;
  day: string;
  caloriesBurned: number;
  caloriesEaten: number;
  workouts: number;
  minutes: number;
}

export interface AthleteDashboard {
  weekly: AthleteWeeklyBucket[];
  totals: {
    caloriesBurned: number;
    caloriesEaten: number;
    minutes: number;
    workouts: number;
  };
  profile: {
    weight: number | null;
    height: number | null;
    fitnessGoal: string | null;
    fitnessLevel: string | null;
  };
}

export interface AthletePersonalization {
  goal: string | null;
  goalLabel: string | null;
  trainingDaysPerWeek: number;
  preferredSplit: string | null;
  preferredSplitRaw: string | null;
  workoutDurationMin: number;
  workoutLocation: string | null;
  workoutTime: string | null;
  dietType: string | null;
  mealsPerDay: string | null;
  mealsPerDayCount?: number;
  sleep: string | null;
  sleepLabel: string | null;
  waterTargetMl: number;
  injuries: string[];
  bodyFocus: string[];
  fitnessLevel: string | null;
  targetWeight: number | null;
  chips: Array<{ icon: string; label: string }>;
  planTitle: string;
}

export interface AthleteCalorieHistoryDay {
  date: string;
  caloriesEaten: number;
  protein: number;
  carbs: number;
  fat: number;
  logCount: number;
}

export interface AthleteHomeDashboard {
  weekly: AthleteWeeklyBucket[];
  /** Last 28 days of logged calories (for nutrition history chart). */
  calorieHistory?: AthleteCalorieHistoryDay[];
  totals: AthleteDashboard['totals'];
  comparison: {
    workouts: number;
    minutes: number;
    caloriesBurned: number;
    caloriesEaten: number;
  };
  today: {
    date: string;
    nutrition: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      logCount: number;
    };
    caloriesBurned: number;
    workouts: Array<{ id: string; title: string; durationMin: number; loggedAt: string }>;
    readinessScore: number;
    readiness: {
      workout: boolean;
      nutrition: boolean;
      proteinProgress: number;
    };
  };
  targets: {
    calorieTarget: number;
    proteinTarget: number;
    carbTarget: number;
    fatTarget: number;
  };
  streak: number;
  heatmap: Array<{ date: string; day: string; workouts: number; minutes: number }>;
  timeline: Array<{
    id: string;
    type: 'food' | 'workout';
    at: string;
    title: string;
    subtitle: string;
    icon: string;
  }>;
  coachTip: string;
  /** Primary alert feed — wire AI coach responses here (source: 'ai', message: '...'). */
  aiAlerts?: DashboardAiAlertsPayload;
  /** @deprecated Flat list kept for backward compatibility; prefer aiAlerts. */
  aiRecommendations?: Array<{ id?: string; key: string; category?: DashboardAlertCategory; params?: Record<string, string> }>;
  personalization?: AthletePersonalization;
  profile: {
    displayName: string | null;
    weight: number | null;
    height: number | null;
    fitnessGoal: string | null;
    fitnessLevel: string | null;
  };
  upcoming: {
    bookings: Array<{
      id: string;
      scheduledAt: string;
      status: string;
      trainer: string;
      avatarUrl: string | null;
    }>;
    notifications: Array<{
      id: string;
      title: string;
      message: string;
      read: boolean;
      createdAt: string;
      link: string | null;
    }>;
    lastCheckIn: {
      gymName: string;
      location: string;
      checkedInAt: string;
    } | null;
  };
  community: Array<{
    id: string;
    content: string;
    likesCount: number;
    commentsCount: number;
    createdAt: string;
    author: string;
    avatarUrl: string | null;
  }>;
  analytics?: {
    calorieAdherenceToday: number;
    proteinAdherenceToday: number;
    workoutCompletionWeek: number;
    workoutCompletionToday: number;
    weightDeltaWeek: number;
    bodyScore: number;
    /** User-entered weights from profile saves (onboardingData.weightLog). */
    weightLog?: Array<{ date: string; weight: number }>;
    weightTrend: Array<{ label: string; weight: number | null }>;
    weeklyAdherence: { categories: string[]; values: number[] };
    volumeProgress: Array<{ label: string; volume: number }>;
    prediction: Array<{ label: string; actual: number | null; forecast?: number | null }>;
    coachPlan?: {
      hasPlan: boolean;
      source: 'rules' | 'ai' | 'manual' | null;
      generatedAt: string | null;
      aiSummary?: string | null;
      editable?: boolean;
      planHorizonWeeks?: number;
      futureWeeksAhead?: number;
      weeks?: Array<{
        weekIndex: number;
        weeklySchedule: Array<{
          dayOfWeek: number;
          isTrainingDay: boolean;
          splitLabel?: string | null;
        }>;
      }>;
    };
    todayWorkoutPlan: {
      hasLoggedToday: boolean;
      isRest?: boolean;
      title: string;
      durationMin: number;
      exercisesCount: number;
      exercises?: Array<{
        exerciseId?: string | null;
        name: string;
        nameAr?: string;
        sets: number;
        reps: number;
        detail?: string;
        category?: string;
        difficulty?: string;
        restSec?: number;
        notes?: string;
      }>;
      planSource?: 'rules' | 'ai' | 'fallback' | 'manual' | null;
    };
    weekPlan?: Array<{
      day: string;
      date: string;
      status: 'done' | 'planned' | 'today' | 'rest';
      isTrainingDay?: boolean;
      splitLabel?: string | null;
    }>;
    dietToday?: {
      calories: { current: number; target: number };
      protein: { current: number; target: number };
      carbs: { current: number; target: number };
      fat: { current: number; target: number };
      water: { currentMl: number; targetMl: number };
      meals?: Array<{
        slot: string;
        name: string;
        grams: number;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        foodItemId?: string | null;
        webtebId?: number | null;
        notes?: string;
      }>;
      planSource?: 'ai' | 'fallback' | 'manual' | null;
      planVersion?: number | null;
    };
    todayMealPlan?: {
      planSource?: 'rules' | 'ai' | 'manual';
      mainMeals: number;
      snacks: number;
      planTotalCalories?: number;
      slots: Array<{
        id: string;
        label: string;
        kind: 'meal' | 'snack';
        items: Array<{
          name: string;
          role?: string;
          grams: number;
          webtebId?: number | null;
          calories?: number;
          protein?: number;
          carbs?: number;
          fat?: number;
          macrosPer100?: {
            calories: number;
            protein: number;
            carbs: number;
            fat: number;
          };
        }>;
        targetCalories: number;
        targetProtein: number | null;
      }>;
    };
    todayMicronutrients?: {
      vitamins: Array<{ name: string; amount: number; unit: string; display: string }>;
      minerals: Array<{ name: string; amount: number; unit: string; display: string }>;
      nutrients: Array<{ name: string; amount: number; unit: string; display: string }>;
      totals: {
        vitaminCount: number;
        mineralCount: number;
        nutrientCount: number;
        trackedFoods: number;
        logCount: number;
      };
    };
  };
  activePlan?: {
    id: string;
    version: number;
    source: 'ai' | 'fallback' | 'manual';
    createdAt?: string;
    dietDaysCount: number;
    workoutWeeksCount: number;
    coachNotes?: string;
  } | null;
  /** Block C7 — same shape as GET /api/plans/today when Postgres daily plan exists. */
  todayPlan?: import('./plansService').TodayPlanPayload | null;
  /** Block C8 — full weekly template (7 days) for week strip navigation. */
  officialWeekPlan?: import('./plansService').WeekPlanPayload | null;
  /** Block C7 — Postgres plan metadata for badges / explainability. */
  planMeta?: {
    storage: 'postgres';
    weekStart: string | null;
    workoutPlanId: string | null;
    dietPlanId: string | null;
    prismaSource: string | null;
    explainabilityText: string | null;
    locale: string;
  } | null;
  todayWorkout?: {
    hasLoggedToday: boolean;
    isRest?: boolean;
    title: string;
    durationMin: number;
    exercisesCount: number;
    exercises?: AthleteHomeDashboard['analytics']['todayWorkoutPlan']['exercises'];
    planSource?: string | null;
    storage?: 'postgres' | 'legacy' | null;
  };
  todayDiet?: {
    calories: { current: number; target: number };
    protein: { current: number; target: number };
    carbs: { current: number; target: number };
    fat: { current: number; target: number };
    water: { currentMl: number; targetMl: number };
    meals?: AthleteHomeDashboard['analytics']['dietToday']['meals'];
    planSource?: string | null;
    dailyTargets?: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      waterMl: number;
    } | null;
    storage?: 'postgres' | 'legacy' | null;
  };
  progressSummary?: {
    calorieAdherenceToday: number;
    proteinAdherenceToday: number;
    workoutCompletionToday: number;
    workoutCompletionWeek: number;
    weightDeltaWeek: number;
    bodyScore: number;
  };
  aiInsights?: string | null;
  nextAction?: string | null;
  /** Block C9 — weekly adaptation review status */
  weeklyAdaptation?: import('./adaptationService').WeeklyAdaptationReview | null;
}

export interface TrainerDashboard {
  totals: {
    clients: number;
    completedSessions: number;
    upcomingSessions: number;
  };
  upcoming: Array<{
    id: string;
    scheduledAt: string;
    status: string;
    notes: string | null;
    athlete: {
      id: string;
      profile: { displayName?: string; avatarUrl?: string } | null;
    };
  }>;
}

export interface GymOwnerDashboard {
  hasGym: boolean;
  gym?: { id: string; name: string; location: string };
  totals?: {
    members: number;
    activeMembers: number;
    newThisMonth: number;
    weekCheckIns: number;
    capacity: number;
    utilization: number;
  };
  monthlySeries?: Array<{ month: string; date: string; checkIns: number }>;
  planDistribution?: Array<{ name: string; value: number }>;
}

class DashboardService {
  athlete() {
    return apiClient.get<AthleteDashboard>('/api/dashboard/athlete');
  }

  athleteHome() {
    return apiClient.get<AthleteHomeDashboard>('/api/dashboard/athlete/home');
  }

  trainer() {
    return apiClient.get<TrainerDashboard>('/api/dashboard/trainer');
  }

  gym() {
    return apiClient.get<GymOwnerDashboard>('/api/dashboard/gym');
  }
}

export const dashboardService = new DashboardService();
export default dashboardService;
