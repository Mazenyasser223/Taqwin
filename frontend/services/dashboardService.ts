import apiClient, { ApiResponse } from './api';

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

export interface AthleteHomeDashboard {
  weekly: AthleteWeeklyBucket[];
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
  aiRecommendations?: Array<{ key: string; params?: Record<string, string> }>;
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
    weightTrend: Array<{ label: string; weight: number | null }>;
    weeklyAdherence: { categories: string[]; values: number[] };
    volumeProgress: Array<{ label: string; volume: number }>;
    prediction: Array<{ label: string; actual: number | null; forecast?: number | null }>;
    todayWorkoutPlan: {
      hasLoggedToday: boolean;
      title: string;
      durationMin: number;
      exercisesCount: number;
      exercises?: Array<{ name: string; sets: number; reps: number; detail?: string }>;
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
