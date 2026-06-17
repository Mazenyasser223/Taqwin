import apiClient, { type ApiResponse } from './api';
import { withTransientRetry, isTransientApiError } from '../lib/apiTransientError';
import {
  peekGetCache,
  peekStaleGetCache,
  setGetCache,
  invalidateGetCache,
} from '../lib/apiGetCache';

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

export type LeagueBootstrapResponse = {
  league: LeagueStatus;
  leaderboard: LeaderboardResponse | null;
  prefetchedLeaderboards?: Partial<Record<LeaderboardScope, LeaderboardResponse>>;
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

export type CompeteDashboardResponse = {
  league: LeagueStatus;
  activeChallenge: ChallengeParticipation | null;
};

const COMPETE_DASHBOARD_CACHE_KEY = 'gamification:compete:dashboard';
const COMPETE_DASHBOARD_SESSION_KEY = 'taqwin:compete:dashboard';
const COMPETE_DASHBOARD_TTL_MS = 2 * 60 * 1000;
const COMPETE_DASHBOARD_STALE_MS = 30 * 60 * 1000;

function readSessionCompeteDashboard(): CompeteDashboardResponse | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(COMPETE_DASHBOARD_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; data?: CompeteDashboardResponse };
    if (!parsed?.data?.league || !parsed.at) return null;
    if (Date.now() - parsed.at > COMPETE_DASHBOARD_STALE_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeSessionCompeteDashboard(data: CompeteDashboardResponse): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(
      COMPETE_DASHBOARD_SESSION_KEY,
      JSON.stringify({ at: Date.now(), data }),
    );
  } catch {
    /* ignore */
  }
}

export function invalidateCompeteDashboardCache(): void {
  invalidateGetCache(COMPETE_DASHBOARD_CACHE_KEY);
  try {
    sessionStorage?.removeItem(COMPETE_DASHBOARD_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function peekCompeteDashboard(): CompeteDashboardResponse | null {
  const cached =
    peekGetCache<CompeteDashboardResponse>(COMPETE_DASHBOARD_CACHE_KEY, COMPETE_DASHBOARD_TTL_MS) ??
    peekStaleGetCache<CompeteDashboardResponse>(COMPETE_DASHBOARD_CACHE_KEY, COMPETE_DASHBOARD_STALE_MS) ??
    readSessionCompeteDashboard();
  return cached;
}

function cacheCompeteDashboard(data: CompeteDashboardResponse): void {
  setGetCache(COMPETE_DASHBOARD_CACHE_KEY, data);
  writeSessionCompeteDashboard(data);
}

class GamificationService {
  me() {
    return apiClient.get<GamificationMe>('/api/gamification/me');
  }

  competeDashboard(): Promise<ApiResponse<CompeteDashboardResponse>> {
    const cached = peekCompeteDashboard();
    const fetcher = () =>
      withTransientRetry(
        () =>
          apiClient.get<CompeteDashboardResponse>('/api/gamification/dashboard', {
            timeoutMs: 30_000,
          }),
        { attempts: 2, baseDelayMs: 600 },
      ).then((res) => {
        if (!res.error && res.data) cacheCompeteDashboard(res.data);
        return res;
      });

    if (cached) {
      void fetcher();
      return Promise.resolve({ data: cached });
    }
    return fetcher();
  }

  updateSettings(patch: Partial<GamificationSettings>) {
    return apiClient.patch<{ settings: GamificationSettings }>('/api/gamification/settings', patch);
  }

  joinLeague() {
    return apiClient.post<{ ok: boolean; league: LeagueStatus }>('/api/gamification/league/join', {});
  }

  leagueCurrent(opts?: { light?: boolean }) {
    const qs = opts?.light ? '?light=1' : '';
    return apiClient.get<LeagueStatus>(`/api/gamification/league/current${qs}`, { timeoutMs: 45000 });
  }

  leagueBootstrap(scope: LeaderboardScope = 'league', limit = 50, prefetchScopes?: LeaderboardScope[]) {
    const prefetch =
      prefetchScopes?.length ? `&prefetch=${prefetchScopes.join(',')}` : '';
    return apiClient.get<LeagueBootstrapResponse>(
      `/api/gamification/league/bootstrap?scope=${scope}&limit=${limit}${prefetch}`,
      { timeoutMs: 45000 },
    );
  }

  leaderboard(scope: LeaderboardScope = 'league', limit = 50) {
    return apiClient.get<LeaderboardResponse>(
      `/api/gamification/league/leaderboard?scope=${scope}&limit=${limit}`,
      { timeoutMs: 45000 },
    );
  }

  challenges(opts?: { refresh?: boolean }) {
    const qs = opts?.refresh ? '?refresh=1' : '';
    return apiClient.get<ChallengesListResponse>(`/api/gamification/challenges${qs}`);
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
