const PREFIX = 'taqwin_tour_done';

function key(userId: string, tourId: string) {
  return `${PREFIX}:${userId}:${tourId}`;
}

export function isTourDone(userId: string | undefined | null, tourId: string): boolean {
  if (!userId || typeof localStorage === 'undefined') return true;
  try {
    return localStorage.getItem(key(userId, tourId)) === '1';
  } catch {
    return true;
  }
}

export function markTourDone(userId: string | undefined | null, tourId: string): void {
  if (!userId || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key(userId, tourId), '1');
  } catch {
    /* ignore */
  }
}

export function resetTour(userId: string | undefined | null, tourId: string): void {
  if (!userId || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(key(userId, tourId));
  } catch {
    /* ignore */
  }
}
