/**
 * Training vs rest day indexes (dayIndex 1=Sun … 7=Sat) from onboarding choices.
 */

const WEEKDAY_TO_DAY_INDEX = {
  sun: 1,
  mon: 2,
  tue: 3,
  wed: 4,
  thu: 5,
  fri: 6,
  sat: 7,
};

/** Default training day indexes when coach picks the schedule (Sun=1 … Sat=7). */
const TRAINING_DAY_PATTERNS = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 6],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
};

function arr(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

function clampTrainingDays(raw) {
  const m = String(raw ?? '').match(/(\d+)/);
  const n = m ? Number(m[1]) : 4;
  return Math.min(6, Math.max(2, Number.isFinite(n) ? n : 4));
}

function parseFixedRestDayIndexes(onboardingData = {}) {
  if (String(onboardingData.restDaysPreference || '') !== 'fixed') return null;
  const indexes = arr(onboardingData.fixedRestDays)
    .map((key) => WEEKDAY_TO_DAY_INDEX[String(key).toLowerCase()])
    .filter(Boolean);
  return indexes.length ? [...new Set(indexes)] : null;
}

/**
 * @param {Record<string, unknown>} onboardingData
 * @returns {number[]} dayIndex values (1–7) that are training days
 */
function resolveTrainingDayIndexes(onboardingData = {}) {
  const trainingDays = clampTrainingDays(onboardingData.trainingDaysPerWeek);
  const restPref = String(onboardingData.restDaysPreference || 'coach').toLowerCase();

  if (restPref === 'minimal') {
    return TRAINING_DAY_PATTERNS[trainingDays] || TRAINING_DAY_PATTERNS[6];
  }

  const fixedRest = parseFixedRestDayIndexes(onboardingData);
  if (fixedRest?.length) {
    const restSet = new Set(fixedRest);
    const trainDays = [];
    for (let dayIndex = 1; dayIndex <= 7; dayIndex += 1) {
      if (!restSet.has(dayIndex)) trainDays.push(dayIndex);
    }
    if (trainDays.length === trainingDays) return trainDays;
  }

  return TRAINING_DAY_PATTERNS[trainingDays] || TRAINING_DAY_PATTERNS[4];
}

function isTrainingDayIndex(dayIndex, onboardingData = {}) {
  return resolveTrainingDayIndexes(onboardingData).includes(dayIndex);
}

module.exports = {
  WEEKDAY_TO_DAY_INDEX,
  TRAINING_DAY_PATTERNS,
  clampTrainingDays,
  resolveTrainingDayIndexes,
  isTrainingDayIndex,
};
