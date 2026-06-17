import gamificationService, { type LeagueStatus } from '../../services/gamificationService';

/**
 * Load league status from the lightweight league endpoint (no leaderboard payload).
 */
export async function loadLeagueStatus(opts?: {
  onUpdate?: (status: LeagueStatus) => void;
}): Promise<{ status: LeagueStatus | null; error: string | null }> {
  const res = await gamificationService.leagueCurrent({ light: true });
  if (!res.error && res.data) {
    opts?.onUpdate?.(res.data);
    return { status: res.data, error: null };
  }
  return { status: { optedIn: false }, error: res.error || null };
}
