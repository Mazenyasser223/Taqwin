export type WeightLogEntry = {
  date: string;
  weight: number;
};

const WEIGHT_LOG_PREFIX = 'taqwin-weight-log';
const MAX_ENTRIES = 120;

export function weightLogStorageKey(userId: string): string {
  return `${WEIGHT_LOG_PREFIX}:${userId}`;
}

function normalizeEntry(raw: unknown): WeightLogEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as { date?: unknown; weight?: unknown };
  if (typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return null;
  const weight = Number(row.weight);
  if (!Number.isFinite(weight) || weight <= 0 || weight > 500) return null;
  return { date: row.date, weight: Math.round(weight * 10) / 10 };
}

export function mergeWeightLogs(
  serverLog: WeightLogEntry[] | undefined,
  localLog: WeightLogEntry[]
): WeightLogEntry[] {
  const byDate = new Map<string, WeightLogEntry>();
  for (const entry of serverLog ?? []) {
    const n = normalizeEntry(entry);
    if (n) byDate.set(n.date, n);
  }
  for (const entry of localLog) {
    const n = normalizeEntry(entry);
    if (n) byDate.set(n.date, n);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_ENTRIES);
}

export function readLocalWeightLog(userId: string | undefined): WeightLogEntry[] {
  if (!userId || typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(weightLogStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeEntry).filter((e): e is WeightLogEntry => e != null);
  } catch {
    return [];
  }
}

export function writeLocalWeightLog(userId: string | undefined, entries: WeightLogEntry[]) {
  if (!userId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(weightLogStorageKey(userId), JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    /* ignore */
  }
}

export function appendLocalWeightLog(
  userId: string | undefined,
  date: string,
  weight: number
): WeightLogEntry[] {
  const next = mergeWeightLogs(readLocalWeightLog(userId), [{ date, weight }]);
  writeLocalWeightLog(userId, next);
  return next;
}

export function parseServerWeightLog(raw: unknown): WeightLogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeEntry).filter((e): e is WeightLogEntry => e != null);
}

/** Use profile weight as week 1 until the user logs an update in Profile. */
export function withProfileWeightBaseline(
  entries: WeightLogEntry[],
  profileWeight: number | null | undefined,
  today: string
): WeightLogEntry[] {
  if (entries.length > 0) return entries;
  if (profileWeight == null || !Number.isFinite(profileWeight)) return [];
  return [{ date: today, weight: Math.round(profileWeight * 10) / 10 }];
}
