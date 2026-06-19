/**
 * Top staple exercises per muscle group × difficulty for plan generation.
 */
const fs = require('fs');
const path = require('path');
const { prisma } = require('../../db');
const { logger } = require('../logger');
const { filterExerciseCandidates } = require('../rag/catalogExercise');

const GROUPS_PATH = path.resolve(__dirname, '../../../../shared/plan-workout-groups.json');
const STAPLES_PATH = path.resolve(__dirname, '../../../../shared/plan-staple-exercises.json');

const DEFAULT_PER_CELL = Math.min(
  50,
  Math.max(10, Number(process.env.PLAN_STAPLE_EXERCISES_PER_CELL || 50)),
);

/** Staple catalog: barbell, dumbbell, or cable only (no bands, machines, bodyweight). */
const STAPLE_BDC_BLOCK =
  /\b(band|bodyweight|body[\s-]?weight|kettlebell|landmine|pull[\s-]?up|push[\s-]?up|chin[\s-]?up|plank|trx|suspension|calisthenic|smith\s*machine|leg\s+press|hack\s+squat|treadmill|elliptical|sled\b|lever\s+(row|press)|machine\s+(press|row|fly|curl)|seated\s+row\s+machine)\b/i;

const STAPLE_BDC_ALLOW =
  /\b(barbell|dumbbell|dumbbells|cable|ez\s*bar|trap\s*bar|straight\s*bar)\b/i;

const STAPLE_BDC_ALLOW_AR = /كابل|دمبل|بار/i;

function isBarDumbbellCableExercise(row) {
  const name = String(row?.name || '');
  const nameAr = String(row?.nameAr || '');
  const text = `${name} ${nameAr} ${String(row?.category || '')}`.toLowerCase();
  if (STAPLE_BDC_BLOCK.test(text)) return false;
  if (STAPLE_BDC_ALLOW.test(text)) return true;
  if (STAPLE_BDC_ALLOW_AR.test(`${nameAr}${name}`)) return true;
  return false;
}

function filterStapleEquipment(rows) {
  return rows.filter(isBarDumbbellCableExercise);
}

let stapleCache = null;
let stapleCacheAt = 0;
const CACHE_TTL_MS = 15 * 60 * 1000;

function loadGroupConfig() {
  return JSON.parse(fs.readFileSync(GROUPS_PATH, 'utf8'));
}

function normalizeDifficulty(raw) {
  const d = String(raw || 'intermediate').toLowerCase();
  if (d.includes('begin') || d === 'novice') return 'beginner';
  if (d.includes('adv') || d === 'expert') return 'advanced';
  return 'intermediate';
}

function difficultyDbVariants(level) {
  const cap = level.charAt(0).toUpperCase() + level.slice(1);
  return [level, cap, level.toUpperCase(), cap.toUpperCase()];
}

function rowToCatalogItem(row, muscleGroup, difficulty, locale) {
  const name = locale === 'ar' && row.nameAr ? row.nameAr : row.name;
  return {
    id: row.id,
    exerciseId: row.id,
    name,
    nameAr: row.nameAr || null,
    category: row.category || '',
    difficulty: normalizeDifficulty(row.difficulty),
    primaryMuscles: Array.isArray(row.primaryMuscles) ? row.primaryMuscles : [],
    browseMuscleZone: row.browseMuscleZone || null,
    muscleGroup,
    planDifficulty: difficulty,
    _staple: true,
  };
}

async function loadExercisePopularityRank() {
  try {
    const rows = await prisma.$queryRaw`
      SELECT e.id AS "exerciseId", COUNT(el.id)::int AS cnt
      FROM exercises e
      LEFT JOIN exercise_logs el ON el.exercise_id = e.id
      WHERE e.is_public = true
      GROUP BY e.id
    `;
    return new Map(rows.map((r) => [String(r.exerciseId), Number(r.cnt) || 0]));
  } catch (err) {
    logger.warn({ err: err.message }, 'plan staple exercise popularity query failed');
    return new Map();
  }
}

function sortExercisesForCell(rows, popularity) {
  return [...rows].sort((a, b) => {
    const popA = popularity.get(a.id) || 0;
    const popB = popularity.get(b.id) || 0;
    if (popB !== popA) return popB - popA;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

async function loadStaplesFromDb({
  onboardingData = {},
  profile = {},
  locale = 'ar',
  perCell = DEFAULT_PER_CELL,
} = {}) {
  const config = loadGroupConfig();
  const popularity = await loadExercisePopularityRank();
  const allZones = new Set();
  for (const def of Object.values(config.groups)) {
    for (const z of def.zones || []) allZones.add(z);
  }

  const dbRows = await prisma.exercise.findMany({
    where: {
      isPublic: true,
      browseMuscleZone: { in: [...allZones] },
    },
    select: {
      id: true,
      name: true,
      nameAr: true,
      category: true,
      difficulty: true,
      primaryMuscles: true,
      browseMuscleZone: true,
    },
  });

  const byCell = {};
  for (const [groupKey, groupDef] of Object.entries(config.groups)) {
    const zones = new Set(groupDef.zones || []);
    for (const difficulty of config.difficulties || ['beginner', 'intermediate', 'advanced']) {
      const cellKey = `${groupKey}:${difficulty}`;
      const variants = new Set(difficultyDbVariants(difficulty));
      let candidates = dbRows.filter((row) => {
        if (!zones.has(row.browseMuscleZone)) return false;
        const rowDiff = normalizeDifficulty(row.difficulty);
        if (row.difficulty == null || row.difficulty === '') {
          return difficulty === 'intermediate';
        }
        return variants.has(String(row.difficulty)) || rowDiff === difficulty;
      });

      if (!candidates.length) {
        candidates = dbRows.filter(
          (row) => zones.has(row.browseMuscleZone) && normalizeDifficulty(row.difficulty) === difficulty,
        );
      }

      candidates = filterStapleEquipment(candidates);
      candidates = sortExercisesForCell(candidates, popularity).slice(0, perCell);
      const normalized = candidates.map((row) =>
        rowToCatalogItem(row, groupKey, difficulty, locale),
      );
      byCell[cellKey] = filterExerciseCandidates(normalized, { onboardingData, profile });
    }
  }

  return flattenStapleExercises(byCell, config);
}

function loadStaplesFromJson({ onboardingData = {}, profile = {}, locale = 'ar' } = {}) {
  if (!fs.existsSync(STAPLES_PATH)) return [];
  const payload = JSON.parse(fs.readFileSync(STAPLES_PATH, 'utf8'));
  const cells = payload.cells || {};
  const out = [];
  for (const items of Object.values(cells)) {
    for (const item of filterStapleEquipment(items || [])) {
      out.push({
        ...item,
        id: item.id || item.exerciseId,
        exerciseId: item.exerciseId || item.id,
        name:
          locale === 'ar' && item.nameAr
            ? item.nameAr
            : item.nameEn || item.name,
        _staple: true,
      });
    }
  }
  return filterExerciseCandidates(out, { onboardingData, profile });
}

function flattenStapleExercises(byCell, config) {
  const out = [];
  const difficulties = config.difficulties || ['beginner', 'intermediate', 'advanced'];
  for (const groupKey of Object.keys(config.groups)) {
    for (const difficulty of difficulties) {
      const cellKey = `${groupKey}:${difficulty}`;
      for (const item of byCell[cellKey] || []) out.push(item);
    }
  }
  return out;
}

async function loadPlanStapleExerciseCatalog(opts = {}) {
  const fromDb = String(process.env.PLAN_STAPLE_EXERCISES_FROM_DB || 'true').toLowerCase() !== 'false';
  const now = Date.now();
  const cacheKey = `${opts.locale || 'ar'}:${opts.onboardingData?.fitnessLevel || ''}`;
  if (stapleCache && stapleCache.key === cacheKey && now - stapleCacheAt < CACHE_TTL_MS) {
    return filterExerciseCandidates(stapleCache.items, {
      onboardingData: opts.onboardingData || {},
      profile: opts.profile || {},
    });
  }

  let items = [];
  if (fromDb) {
    try {
      items = await loadStaplesFromDb(opts);
    } catch (err) {
      logger.warn({ err: err.message }, 'plan staple exercises DB load failed — JSON fallback');
      items = loadStaplesFromJson(opts);
    }
  } else {
    items = loadStaplesFromJson(opts);
  }
  if (!items.length) items = loadStaplesFromJson(opts);

  stapleCache = { items, key: cacheKey };
  stapleCacheAt = now;
  return items;
}

module.exports = {
  loadPlanStapleExerciseCatalog,
  loadStaplesFromDb,
  loadStaplesFromJson,
  loadGroupConfig,
  normalizeDifficulty,
  isBarDumbbellCableExercise,
  filterStapleEquipment,
  STAPLES_PATH,
  GROUPS_PATH,
};
