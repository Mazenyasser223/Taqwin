import type { LeaderboardEntry } from '../../services/gamificationService';

/** Days remaining until an inclusive week-end date key (YYYY-MM-DD). */
export function daysUntilDateKey(endKey: string, now = new Date()): number {
  const todayKey = now.toISOString().slice(0, 10);
  const endMs = new Date(`${endKey}T12:00:00.000Z`).getTime();
  const todayMs = new Date(`${todayKey}T12:00:00.000Z`).getTime();
  return Math.max(0, Math.ceil((endMs - todayMs) / 86_400_000));
}

export function leaderScore(entries: LeaderboardEntry[]): number {
  const top = entries.find((e) => e.weeklyAvg != null)?.weeklyAvg;
  return top != null && top > 0 ? top : 100;
}

export function promotionCutoffRank(entryCount: number): number {
  if (entryCount < 2) return 0;
  return Math.max(1, Math.floor(entryCount * 0.2));
}

export function listEntriesAfterPodium(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return entries.filter((e) => e.rank == null || e.rank > 3);
}
