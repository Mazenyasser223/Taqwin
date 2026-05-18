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
  trainer() {
    return apiClient.get<TrainerDashboard>('/api/dashboard/trainer');
  }
  gym() {
    return apiClient.get<GymOwnerDashboard>('/api/dashboard/gym');
  }
}

export const dashboardService = new DashboardService();
export default dashboardService;
