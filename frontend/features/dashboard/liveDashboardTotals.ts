export type LiveDietTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

const LIVE_DIET_PREFIX = 'taqwin-live-diet-totals';

export function writeLiveDietTotals(
  userId: string | undefined,
  date: string,
  totals: LiveDietTotals
) {
  if (!userId || typeof window === 'undefined') return;
  sessionStorage.setItem(`${LIVE_DIET_PREFIX}:${userId}:${date}`, JSON.stringify(totals));
}

export function readLiveDietTotals(
  userId: string | undefined,
  date: string
): LiveDietTotals | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${LIVE_DIET_PREFIX}:${userId}:${date}`);
    if (!raw) return null;
    return JSON.parse(raw) as LiveDietTotals;
  } catch {
    return null;
  }
}
