/**
 * Persist user-entered weight readings in profile.onboardingData.weightLog.
 */

function utcTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = raw.date;
  const weight = Number(raw.weight);
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!Number.isFinite(weight) || weight <= 0 || weight > 500) return null;
  return { date, weight: Math.round(weight * 10) / 10 };
}

function appendWeightLog(existingLog, date, weight) {
  const log = Array.isArray(existingLog)
    ? existingLog.map(normalizeEntry).filter(Boolean)
    : [];
  const filtered = log.filter((e) => e.date !== date);
  filtered.push({ date, weight: Math.round(weight * 10) / 10 });
  filtered.sort((a, b) => a.date.localeCompare(b.date));
  return filtered.slice(-120);
}

function mergeOnboardingWeightLog(onboardingData, weight) {
  return mergeOnboardingWeightLogForDate(onboardingData, weight, utcTodayKey());
}

function mergeOnboardingWeightLogForDate(onboardingData, weight, dateKey) {
  const od =
    onboardingData && typeof onboardingData === 'object' && !Array.isArray(onboardingData)
      ? { ...onboardingData }
      : {};
  if (weight == null || !Number.isFinite(Number(weight))) {
    return od;
  }
  if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return od;
  }
  od.weightLog = appendWeightLog(od.weightLog, dateKey, Number(weight));
  return od;
}

/** Merge profile weight log entries with body-metric rows (latest per date wins). */
function mergeWeightLogSources(profileEntries, bodyMetrics, dateKeyFn) {
  const byDate = new Map();
  for (const e of profileEntries) {
    if (e?.date) byDate.set(e.date, e.weight);
  }
  for (const m of bodyMetrics) {
    if (m?.recordedAt == null || m?.weightKg == null) continue;
    const key = dateKeyFn(m.recordedAt);
    if (key) byDate.set(key, Math.round(Number(m.weightKg) * 10) / 10);
  }
  return [...byDate.entries()]
    .map(([date, weight]) => ({ date, weight }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-120);
}

function parseWeightLog(onboardingData) {
  const raw = onboardingData?.weightLog;
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeEntry).filter(Boolean);
}

module.exports = {
  mergeOnboardingWeightLog,
  mergeOnboardingWeightLogForDate,
  parseWeightLog,
  appendWeightLog,
  mergeWeightLogSources,
};
