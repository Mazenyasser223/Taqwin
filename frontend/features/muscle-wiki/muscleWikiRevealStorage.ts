const KEY_PREFIX = 'taqwin:muscle-wiki-revealed:';

export function hasMuscleWikiReveal(userId: string | undefined | null): boolean {
  if (!userId || typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(`${KEY_PREFIX}${userId}`) === '1';
  } catch {
    return false;
  }
}

export function markMuscleWikiRevealed(userId: string | undefined | null): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${KEY_PREFIX}${userId}`, '1');
  } catch {
    /* ignore quota / private mode */
  }
}
