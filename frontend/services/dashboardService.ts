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
    todayWorkoutPlan: {
      hasLoggedToday: boolean;
      title: string;
      durationMin: number;
      exercisesCount: number;
      exercises?: Array<{
        exerciseId?: string;
        name: string;
        nameAr?: string;
        sets: number;
        reps: number;
        detail?: string;
        category?: string;
        difficulty?: string;
      }>;
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
    };
    todayMealPlan?: {
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
