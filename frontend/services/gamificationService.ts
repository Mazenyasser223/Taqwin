import apiClient from './api';

export type LeaderboardScope = 'league' | 'friends' | 'gym' | 'global';

export type GamificationSettings = {
  leagueOptIn: boolean;
  leaderboardVisibility: 'off' | 'friends' | 'gym' | 'global';
  showOnLeaderboard: boolean;
  challengeNotifications: boolean;
};

export type GamificationProfile = {
  currentTier: string;
  lifetimeXp: number;
  currentXp: number;
};

export type GamificationToday = {
  dateKey: string;
  score: number;
  sleepPts: number;
  mealsPts: number;
  waterPts: number;
  workoutPts: number;
  computedAt: string;
};

export type LeagueStatus = {
  optedIn: boolean;
  season?: {
    id: string;
    weekStart: string;
    weekEnd: string;
    status: string;
  };
  tier?: string;
  weeklyAvg?: number | null;
  daysCounted?: number;
  daysRequired?: number;
  rank?: number | null;
  podSize?: number;
  achievements?: Array<{ slug: string; earnedAt: string }>;
};

export type ChallengeParticipation = {
  id: string;
  slug: string;
  status: 'active' | 'completed' | 'failed' | 'abandoned';
  progress: number;
  target: number;
  startDateKey: string;
  endDateKey: string;
  daysLeft: number;
  progressPct: number;
  completedAt?: string | null;
  xpReward: number;
  icon: string;
  metric: string | null;
  durationDays: number | null;
};

export type ChallengeTemplate = {
  slug: string;
  durationDays: number;
  metric: string;
  target: number;
  xpReward: number;
  badgeSlug: string;
  icon: string;
  sortOrder: number;
  activeParticipation?: ChallengeParticipation | null;
  lastParticipation?: ChallengeParticipation | null;
};

export type ChallengeDailyDay = {
  dateKey: string;
  met: boolean;
  pending: boolean;
};

export type ChallengeDetail = {
  participation: ChallengeParticipation;
  template: ChallengeTemplate | null;
  daily: ChallengeDailyDay[];
};

export type ChallengesListResponse = {
  catalog: ChallengeTemplate[];
  active: ChallengeParticipation[];
  completedCount: number;
};

export type AchievementBadge = {
  slug: string;
  icon: string;
  category: string;
  earnedAt?: string;
  earned?: boolean;
  challengeSlug?: string;
};

export type GamificationAchievements = {
  profile: GamificationProfile;
  earned: AchievementBadge[];
  catalog: AchievementBadge[];
};

export type GamificationMe = {
  settings: GamificationSettings;
  profile: GamificationProfile;
  today: GamificationToday;
  weekly: {
    weekStart: string;
    weekEnd: string;
    daysCounted: number;
    weeklyAvg: number | null;
    daily: Array<{ dateKey: string; score: number | null }>;
  };
  league: LeagueStatus;
  challenges: {
    active: ChallengeParticipation[];
    completedCount: number;
  };
};

export type LeaderboardEntry = {
  rank: number | null;
  userId: string;
  displayName: string | null;
  anonymous?: boolean;
  avatarUrl: string | null;
  weeklyAvg: number | null;
  daysCounted: number;
  tier: string;
  isSelf: boolean;
  qualified?: boolean;
};

export type LeaderboardResponse = {
  scope: LeaderboardScope;
  tier: string | null;
  season: { weekStart: string; weekEnd: string };
  entries: LeaderboardEntry[];
};

export type SocialFriend = {
  id: string;
  email?: string;
  displayName?: string | null;
  handle?: string;
  avatarUrl?: string | null;
  communityAvatarUrl?: string | null;
};

export type SocialDuel = {
  id: string;
  templateSlug: string;
  status: 'pending' | 'active' | 'completed' | 'declined' | 'cancelled';
  role: 'challenger' | 'opponent';
  opponent: SocialFriend | null;
  startDateKey?: string | null;
  endDateKey?: string | null;
  target?: number | null;
  winnerId?: string | null;
  myProgressPct?: number | null;
  theirProgressPct?: number | null;
  durationDays?: number | null;
  icon: string;
  createdAt: string;
};

export type SocialSquad = {
  id: string;
  name?: string | null;
  templateSlug: string;
  status: 'recruiting' | 'active' | 'completed' | 'cancelled';
  ownerId: string;
  isOwner: boolean;
  maxMembers: number;
  memberCount: number;
  members: Array<{ userId: string; role: string; user: SocialFriend | null }>;
  startDateKey?: string | null;
  endDateKey?: string | null;
  target?: number | null;
  avgProgressPct?: number | null;
  durationDays?: number | null;
  icon: string;
  createdAt: string;
};

export type SocialChallengeOption = {
  slug: string;
  durationDays: number;
  target: number;
  icon: string;
};

export type SocialOverview = {
  friends: SocialFriend[];
  duels: {
    pending: SocialDuel[];
    active: SocialDuel[];
    completed: SocialDuel[];
  };
  squads: {
    recruiting: SocialSquad[];
    active: SocialSquad[];
    completed: SocialSquad[];
  };
  openSquads: SocialSquad[];
  challengeOptions: SocialChallengeOption[];
};

class GamificationService {
  me() {
    return apiClient.get<GamificationMe>('/api/gamification/me');
  }

  updateSettings(patch: Partial<GamificationSettings>) {
    return apiClient.patch<{ settings: GamificationSettings }>('/api/gamification/settings', patch);
  }

  joinLeague() {
    return apiClient.post<{ ok: boolean; league: LeagueStatus }>('/api/gamification/league/join', {});
  }

  leagueCurrent() {
    return apiClient.get<LeagueStatus>('/api/gamification/league/current');
  }

  leaderboard(scope: LeaderboardScope = 'league', limit = 50) {
    return apiClient.get<LeaderboardResponse>(
      `/api/gamification/league/leaderboard?scope=${scope}&limit=${limit}`,
    );
  }

  challenges() {
    return apiClient.get<ChallengesListResponse>('/api/gamification/challenges');
  }

  challengesSummary() {
    return apiClient.get<Pick<ChallengesListResponse, 'active' | 'completedCount'>>(
      '/api/gamification/challenges/summary',
    );
  }

  joinChallenge(slug: string) {
    return apiClient.post<{ participation: ChallengeParticipation; template: ChallengeTemplate }>(
      `/api/gamification/challenges/${slug}/join`,
      {},
    );
  }

  challengeDetail(participantId: string) {
    return apiClient.get<ChallengeDetail>(`/api/gamification/challenges/participant/${participantId}`);
  }

  leaveChallenge(participantId: string) {
    return apiClient.post<{ ok: boolean }>(`/api/gamification/challenges/participant/${participantId}/leave`, {});
  }

  achievements() {
    return apiClient.get<GamificationAchievements>('/api/gamification/achievements');
  }

  social() {
    return apiClient.get<SocialOverview>('/api/gamification/social');
  }

  inviteDuel(opponentId: string, templateSlug: string) {
    return apiClient.post<SocialDuel>('/api/gamification/duels', { opponentId, templateSlug });
  }

  acceptDuel(duelId: string) {
    return apiClient.post<SocialDuel>(`/api/gamification/duels/${duelId}/accept`, {});
  }

  declineDuel(duelId: string) {
    return apiClient.post<{ ok: boolean }>(`/api/gamification/duels/${duelId}/decline`, {});
  }

  cancelDuel(duelId: string) {
    return apiClient.post<{ ok: boolean }>(`/api/gamification/duels/${duelId}/cancel`, {});
  }

  createSquad(templateSlug: string, name?: string) {
    return apiClient.post<SocialSquad>('/api/gamification/squads', { templateSlug, name });
  }

  joinSquad(squadId: string) {
    return apiClient.post<SocialSquad>(`/api/gamification/squads/${squadId}/join`, {});
  }

  startSquad(squadId: string) {
    return apiClient.post<SocialSquad>(`/api/gamification/squads/${squadId}/start`, {});
  }

  leaveSquad(squadId: string) {
    return apiClient.post<{ ok: boolean }>(`/api/gamification/squads/${squadId}/leave`, {});
  }
}

export const gamificationService = new GamificationService();
export default gamificationService;
