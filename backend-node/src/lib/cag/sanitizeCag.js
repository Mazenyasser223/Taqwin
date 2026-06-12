/**
 * CAG prompt-injection sanitization — strip/limit user-controlled strings before LLM prompts.
 * Rules: shared/cag-sanitize.json (keep in sync with ai-service/app/services/cag_sanitize.py).
 */
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../../../../shared/cag-sanitize.json');

let _config = null;

function loadConfig() {
  if (_config) return _config;
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  _config = JSON.parse(raw);
  return _config;
}

function resetConfigForTests() {
  _config = null;
}

function getFieldLimit(field) {
  const cfg = loadConfig();
  return cfg.fieldLimits[field] ?? cfg.fieldLimits.default ?? 200;
}

function isSingleLineField(field) {
  const cfg = loadConfig();
  return (cfg.singleLineFields || []).includes(field);
}

function instructionPatterns() {
  const cfg = loadConfig();
  return (cfg.instructionPatterns || []).map((p) => new RegExp(p, 'gi'));
}

function onboardingArrayField(key) {
  const cfg = loadConfig();
  return (cfg.onboardingArrayFields || {})[key] || 'default';
}

/** @returns {{ hits: number, truncated: number, fields: Record<string, number> }} */
function newSanitizeStats() {
  return { hits: 0, truncated: 0, fields: {} };
}

/**
 * @param {{ hits: number, truncated: number, fields: Record<string, number> }|null|undefined} stats
 * @param {string} field
 * @param {unknown} before
 * @param {unknown} after
 */
function recordSanitizeDelta(stats, field, before, after) {
  if (!stats) return;
  const b = String(before ?? '');
  const a = String(after ?? '');
  if (b === a) return;
  stats.hits += 1;
  stats.fields[field] = (stats.fields[field] || 0) + 1;
  if (a.endsWith('…') && b.length > a.length) stats.truncated += 1;
}

function normalizeNfkc(text) {
  return typeof text.normalize === 'function' ? text.normalize('NFKC') : text;
}

/**
 * @param {Record<string, unknown>|null|undefined} measurements
 */
function sanitizeMeasurements(measurements, stats = null) {
  if (!measurements || typeof measurements !== 'object' || Array.isArray(measurements)) {
    return measurements;
  }
  const out = {};
  for (const [key, val] of Object.entries(measurements)) {
    if (typeof val === 'string') {
      out[key] = sanitizeCagString(val, 'default', stats);
    } else if (val != null && typeof val === 'number') {
      out[key] = val;
    } else {
      out[key] = val;
    }
  }
  return out;
}

/**
 * @param {Record<string, unknown>|null|undefined} weekSummary
 */
function sanitizeWeekPlanSummary(weekSummary, stats = null) {
  if (!weekSummary || typeof weekSummary !== 'object') return weekSummary;
  const out = { ...weekSummary };
  if (out.coachNotes != null) {
    out.coachNotes = sanitizeCagString(String(out.coachNotes), 'coachNotes', stats);
  }
  if (Array.isArray(out.workoutDays)) {
    out.workoutDays = out.workoutDays.map((d) =>
      d && typeof d === 'object'
        ? {
            ...d,
            type:
              d.type != null ? sanitizeCagString(String(d.type), 'exerciseName', stats) : d.type,
          }
        : d
    );
  }
  return out;
}

/**
 * @param {Record<string, unknown>|null|undefined} workoutDay
 */
function sanitizeWorkoutDaySummary(workoutDay, stats = null) {
  if (!workoutDay || typeof workoutDay !== 'object') return workoutDay;
  const out = { ...workoutDay };
  if (out.type != null) {
    out.type = sanitizeCagString(String(out.type), 'exerciseName', stats);
  }
  if (Array.isArray(out.exercises)) {
    out.exercises = out.exercises.map((e) =>
      e && typeof e === 'object'
        ? { ...e, name: sanitizeCagString(String(e.name || ''), 'exerciseName', stats) }
        : e
    );
  }
  return out;
}

/**
 * @param {unknown} value
 * @param {string} [field='default']
 * @param {{ hits: number, truncated: number, fields: Record<string, number> }|null} [stats]
 * @returns {string|null|unknown}
 */
function sanitizeCagString(value, field = 'default', stats = null) {
  if (value == null) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;

  const raw = normalizeNfkc(value);
  // eslint-disable-next-line no-control-regex -- strip C0/C1 control chars from user-supplied CAG text
  let text = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  text = text.replace(/```+/g, '');

  for (const re of instructionPatterns()) {
    text = text.replace(re, '[removed]');
  }

  if (isSingleLineField(field)) {
    text = text.replace(/\s+/g, ' ').trim();
  } else {
    text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  const limit = getFieldLimit(field);
  if (text.length > limit) {
    text = `${text.slice(0, Math.max(0, limit - 1))}…`;
  }

  recordSanitizeDelta(stats, field, raw, text);
  return text;
}

function sanitizePromptText(value, field = 'userMessage') {
  return sanitizeCagString(value, field);
}

function sanitizePendingPreview(value, stats = null) {
  return String(sanitizeCagString(value, 'pendingPreview', stats) || '').trim();
}

/**
 * @param {string[]} items
 * @param {string} field
 * @param {{ hits: number, truncated: number, fields: Record<string, number> }|null} [stats]
 * @returns {string[]}
 */
function sanitizeStringList(items, field = 'injuryLabel', stats = null) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (item == null || item === '') return null;
      const s = sanitizeCagString(String(item), field, stats);
      return s && String(s).trim() ? String(s).trim() : null;
    })
    .filter(Boolean);
}

/**
 * @param {Record<string, unknown>|null|undefined} section
 * @returns {Record<string, unknown>|null|undefined}
 */
function sanitizeOnboardingSection(section, stats = null) {
  if (!section || typeof section !== 'object') return section;
  const cfg = loadConfig();
  const freeText = new Set(cfg.onboardingFreeTextKeys || []);
  const out = {};
  for (const [key, val] of Object.entries(section)) {
    if (val == null || val === '') continue;
    if (Array.isArray(val)) {
      out[key] = sanitizeStringList(val, onboardingArrayField(key), stats);
    } else if (typeof val === 'string') {
      const field = freeText.has(key)
        ? key === 'medicalHistory' || key === 'medications'
          ? 'medicalNotes'
          : 'onboardingText'
        : key === 'displayName'
          ? 'displayName'
          : 'onboardingText';
      out[key] = sanitizeCagString(val, field, stats);
    } else {
      out[key] = val;
    }
  }
  return out;
}

/**
 * @param {Record<string, unknown>|null|undefined} profile
 */
function sanitizeProfile(profile, stats = null) {
  if (!profile || typeof profile !== 'object') return profile;
  return {
    ...profile,
    displayName:
      profile.displayName != null
        ? sanitizeCagString(String(profile.displayName), 'displayName', stats)
        : profile.displayName,
    medicalNotes:
      profile.medicalNotes != null
        ? sanitizeCagString(String(profile.medicalNotes), 'medicalNotes', stats)
        : profile.medicalNotes,
  };
}

/**
 * Deep-sanitize a CAG bundle before cache/prompt use.
 * @param {Record<string, unknown>|null|undefined} bundle
 * @param {{ hits: number, truncated: number, fields: Record<string, number> }|null} [stats]
 * @returns {Record<string, unknown>|null|undefined}
 */
function sanitizeCagBundle(bundle, stats = null) {
  if (!bundle || typeof bundle !== 'object') return bundle;

  const out = { ...bundle };

  if (out.profile) out.profile = sanitizeProfile(out.profile, stats);

  if (out.onboardingSummary && typeof out.onboardingSummary === 'object') {
    out.onboardingSummary = sanitizeOnboardingSection(out.onboardingSummary, stats);
  }

  if (out.bodyMetricsLatest && typeof out.bodyMetricsLatest === 'object') {
    out.bodyMetricsLatest = {
      ...out.bodyMetricsLatest,
      measurements: sanitizeMeasurements(out.bodyMetricsLatest.measurements, stats),
    };
  }

  if (out.workoutWeek && typeof out.workoutWeek === 'object') {
    out.workoutWeek = sanitizeWeekPlanSummary(out.workoutWeek, stats);
  }

  if (out.onboardingByFlow && typeof out.onboardingByFlow === 'object') {
    const flows = {};
    for (const [key, section] of Object.entries(out.onboardingByFlow)) {
      flows[key] = sanitizeOnboardingSection(section, stats);
    }
    out.onboardingByFlow = flows;
  }

  if (out.nutritionToday && typeof out.nutritionToday === 'object') {
    const nt = { ...out.nutritionToday };
    if (Array.isArray(nt.foods)) {
      nt.foods = nt.foods.map((f) =>
        f && typeof f === 'object'
          ? { ...f, name: sanitizeCagString(String(f.name || 'Unknown'), 'foodName', stats) }
          : f
      );
    }
    out.nutritionToday = nt;
  }

  if (out.nutritionWeek && typeof out.nutritionWeek === 'object') {
    out.nutritionWeek = {
      ...out.nutritionWeek,
      recentFoodNames: sanitizeStringList(out.nutritionWeek.recentFoodNames, 'foodName', stats),
    };
  }

  if (out.workoutToday && typeof out.workoutToday === 'object') {
    out.workoutToday = sanitizeWorkoutDaySummary(out.workoutToday, stats);
  }

  if (out.todayPlan && typeof out.todayPlan === 'object') {
    const tp = { ...out.todayPlan };
    if (tp.diet && Array.isArray(tp.diet.meals)) {
      tp.diet = {
        ...tp.diet,
        meals: tp.diet.meals.map((m) =>
          m && typeof m === 'object'
            ? { ...m, name: sanitizeCagString(String(m.name || ''), 'foodName', stats) }
            : m
        ),
      };
    }
    if (tp.workout && typeof tp.workout === 'object') {
      tp.workout = sanitizeWorkoutDaySummary(tp.workout, stats);
    }
    if (tp.dailyAthletePlan && typeof tp.dailyAthletePlan === 'object') {
      tp.dailyAthletePlan = {
        ...tp.dailyAthletePlan,
        explainabilityText:
          tp.dailyAthletePlan.explainabilityText != null
            ? sanitizeCagString(String(tp.dailyAthletePlan.explainabilityText), 'explainabilityText', stats)
            : tp.dailyAthletePlan.explainabilityText,
      };
    }
    out.todayPlan = tp;
  }

  if (out.weekPlanSummary && typeof out.weekPlanSummary === 'object') {
    out.weekPlanSummary = sanitizeWeekPlanSummary(out.weekPlanSummary, stats);
  }

  if (out.readinessLatest && typeof out.readinessLatest === 'object') {
    out.readinessLatest = {
      ...out.readinessLatest,
      notes:
        out.readinessLatest.notes != null
          ? sanitizeCagString(String(out.readinessLatest.notes), 'readinessNotes', stats)
          : out.readinessLatest.notes,
    };
  }

  if (out.progressSnapshot && typeof out.progressSnapshot === 'object') {
    out.progressSnapshot = {
      ...out.progressSnapshot,
      aiSummary:
        out.progressSnapshot.aiSummary != null
          ? sanitizeCagString(String(out.progressSnapshot.aiSummary), 'aiSummary', stats)
          : out.progressSnapshot.aiSummary,
    };
  }

  if (Array.isArray(out.aiMemories)) {
    out.aiMemories = out.aiMemories.map((m) =>
      m && typeof m === 'object'
        ? {
            ...m,
            summary:
              m.summary != null
                ? sanitizeCagString(String(m.summary), 'memorySummary', stats)
                : m.summary,
          }
        : m
    );
  }

  if (out.constraints && typeof out.constraints === 'object') {
    const c = out.constraints;
    out.constraints = {
      ...c,
      injuries: sanitizeStringList(c.injuries, 'injuryLabel', stats),
      foodAllergies: sanitizeStringList(c.foodAllergies, 'injuryLabel', stats),
      excludedExercises: sanitizeStringList(c.excludedExercises, 'exerciseName', stats),
      excludedFoods: sanitizeStringList(c.excludedFoods, 'foodName', stats),
      religiousDiet:
        c.religiousDiet != null
          ? sanitizeCagString(String(c.religiousDiet), 'default', stats)
          : c.religiousDiet,
      lifeMode:
        c.lifeMode != null ? sanitizeCagString(String(c.lifeMode), 'default', stats) : c.lifeMode,
    };
  }

  if (out.behavioralSignals && typeof out.behavioralSignals === 'object') {
    const s = out.behavioralSignals;
    out.behavioralSignals = {
      ...s,
      skippedMuscleGroups: sanitizeStringList(s.skippedMuscleGroups, 'default', stats),
      preferredExercises: sanitizeStringList(s.preferredExercises, 'exerciseName', stats),
      mealSkipPatterns: sanitizeStringList(s.mealSkipPatterns, 'default', stats),
    };
  }

  if (out.gymTrainerOrdersSummary && typeof out.gymTrainerOrdersSummary === 'object') {
    const g = out.gymTrainerOrdersSummary;
    out.gymTrainerOrdersSummary = {
      ...g,
      activeGymMemberships: (g.activeGymMemberships || []).map((m) =>
        m && typeof m === 'object'
          ? { ...m, gymName: sanitizeCagString(String(m.gymName || ''), 'gymName', stats) }
          : m
      ),
      recentOrders: (g.recentOrders || []).map((o) =>
        o && typeof o === 'object'
          ? {
              ...o,
              items: (o.items || []).map((i) =>
                i && typeof i === 'object'
                  ? {
                      ...i,
                      name: sanitizeCagString(String(i.name || 'Product'), 'productName', stats),
                    }
                  : i
              ),
            }
          : o
      ),
    };
  }

  return out;
}

module.exports = {
  sanitizeCagString,
  sanitizeCagBundle,
  sanitizeStringList,
  sanitizePromptText,
  sanitizePendingPreview,
  newSanitizeStats,
  loadConfig,
  resetConfigForTests,
  getFieldLimit,
};
