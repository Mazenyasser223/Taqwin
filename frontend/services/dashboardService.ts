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
