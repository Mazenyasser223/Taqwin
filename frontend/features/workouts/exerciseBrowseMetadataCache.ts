const STORAGE_KEY = 'taqwin:exercise-browse-meta:v1';
const TTL_MS = 15 * 60 * 1000;

export type ExerciseBrowseMetadata = {
  categories: { category: string; count: number }[];
  muscleCounts: Record<string, number>;
  difficulties: { difficulty: string; count: number }[];
  goalCounts: Record<string, number>;
  fetchedAt: number;
};

function readStored(): ExerciseBrowseMetadata | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExerciseBrowseMetadata;
    if (!parsed?.fetchedAt || Date.now() - parsed.fetchedAt > TTL_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(payload: ExerciseBrowseMetadata) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function getCachedExerciseBrowseMetadata(): ExerciseBrowseMetadata | null {
  return readStored();
}

export function setCachedExerciseBrowseMetadata(payload: Omit<ExerciseBrowseMetadata, 'fetchedAt'>) {
  writeStored({ ...payload, fetchedAt: Date.now() });
}

export function clearCachedExerciseBrowseMetadata() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
