/**
 * NL → structured args for AI tool execution (Block E lite).
 * Keeps Prisma lookups in Node; FastAPI passes raw user text.
 */
const { prisma } = require('../db');
const { resolveTodayPlan } = require('./plans/dailyAthletePlanService');

const ACTION_VERB_RE =
  /\b(log|record|track|add|سجل|سجّل|ضيف|أضف|احسب|replace|swap|substitute|change|بدّل|بدل|استبدل|استبدال|بدّلي|بدلي)\b/gi;
const GRAMS_RE = /(\d+(?:\.\d+)?)\s*(?:g|gram|grams|جرام|جم|غرام)(?=\s|$|[^\p{L}\p{N}])/iu;
const MEAL_SLOT_RE =
  /\b(for\s+)?(breakfast|lunch|dinner|snack|فطار|غدا|غداء|عشا|عشاء|سناك)\b/gi;
const TODAY_RE = /\b(today|today's|النهارده|النهاردة|اليوم)\b/gi;

const DEFAULT_GRAMS = 150;

function parseGramsFromText(text) {
  const m = String(text || '').match(GRAMS_RE);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function stripActionVerbs(text) {
  return String(text || '')
    .replace(ACTION_VERB_RE, ' ')
    .replace(TODAY_RE, ' ')
    .replace(MEAL_SLOT_RE, ' ')
    .trim();
}

function stripGramsFromText(text) {
  return String(text || '')
    .replace(GRAMS_RE, ' ')
    .replace(MEAL_SLOT_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function foodQueryFromText(text) {
  const stripped = stripGramsFromText(stripActionVerbs(text));
  return stripped.replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} text
 * @returns {{ oldName: string|null, newName: string|null }}
 */
function parseReplacePair(text) {
  const raw = String(text || '').trim();
  if (!raw) return { oldName: null, newName: null };

  const enPatterns = [
    /\b(?:replace|swap|change|substitute)\s+(.+?)\s+(?:with|for|to)\s+(.+)/i,
    /\b(?:instead\s+of)\s+(.+?)\s+(?:use|try|do)\s+(.+)/i,
  ];
  for (const pattern of enPatterns) {
    const m = raw.match(pattern);
    if (m) {
      return {
        oldName: m[1].replace(TODAY_RE, '').trim(),
        newName: m[2].replace(TODAY_RE, '').trim(),
      };
    }
  }

  const ar = raw.match(/(?:بدّل|بدل|بدّلي|بدلي|استبدل|استبدال)\s+(.+?)\s+(?:ب|بـ|بـ|with|for)\s*(.+)/i);
  if (ar) {
    return {
      oldName: ar[1].replace(TODAY_RE, '').trim(),
      newName: ar[2].replace(TODAY_RE, '').trim(),
    };
  }

  const singleNew = raw.match(
    /\b(?:replace|swap|substitute|change|بدّل|بدل|بدّلي|بدلي|استبدل)\s+(?:today'?s?\s+)?(?:exercise|workout|تمرين|تمرين اليوم)?\s*(?:with\s+)?(.+)/i
  );
  if (singleNew) {
    const name = singleNew[1].replace(TODAY_RE, '').replace(MEAL_SLOT_RE, '').trim();
    if (name.length >= 2) return { oldName: null, newName: name };
  }

  return { oldName: null, newName: null };
}

function foodItemTermClause(term) {
  return { name: { contains: term, mode: 'insensitive' } };
}

function _termClauses(term, preferEn) {
  if (preferEn) {
    return {
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { nameAr: { contains: term, mode: 'insensitive' } },
      ],
    };
  }
  return {
    OR: [
      { nameAr: { contains: term, mode: 'insensitive' } },
      { name: { contains: term, mode: 'insensitive' } },
    ],
  };
}

function scoreFoodRow(row, cleaned) {
  const q = cleaned.toLowerCase().trim();
  if (!q) return 0;
  const nameEn = (row.name || '').toLowerCase();
  const nameAr = (row.nameAr || '').toLowerCase();
  if (nameEn === q || nameAr === q) return 1;
  if (nameEn.includes(q) || nameAr.includes(q)) return 0.88;
  const terms = q.split(/\s+/).filter((t) => t.length >= 2);
  if (!terms.length) return 0.5;
  const matched = terms.filter((t) => nameEn.includes(t) || nameAr.includes(t)).length;
  return Math.min(0.85, 0.45 + matched / terms.length * 0.4);
}

async function findFoodCandidates(text, { limit = 5 } = {}) {
  const cleaned = foodQueryFromText(text);
  if (!cleaned || cleaned.length < 2) return [];

  const preferEn = /[a-zA-Z]/.test(cleaned) && !/[\u0600-\u06FF]/.test(cleaned);
  const terms = cleaned.split(/\s+/).filter((t) => t.length >= 2);
  const seen = new Map();

  const addRow = (row, baseScore) => {
    if (!row?.id) return;
    const score = Math.max(baseScore, scoreFoodRow(row, cleaned));
    const prev = seen.get(row.id);
    if (!prev || score > prev.confidence) {
      seen.set(row.id, { ...row, confidence: score });
    }
  };

  const exactRows = await prisma.foodItem.findMany({
    where: {
      isPublic: true,
      name: { contains: cleaned, mode: 'insensitive' },
    },
    take: limit * 2,
    orderBy: { name: 'asc' },
  });
  for (const row of exactRows) addRow(row, 0.85);

  if (terms.length > 1) {
    const termRows = await prisma.foodItem.findMany({
      where: {
        isPublic: true,
        AND: terms.map((term) => foodItemTermClause(term)),
      },
      take: limit * 2,
      orderBy: { name: 'asc' },
    });
    for (const row of termRows) addRow(row, 0.7);
  }

  const webteb = await prisma.webtebFood.findMany({
    where: preferEn
      ? {
          OR: [
            { nameEn: { contains: cleaned, mode: 'insensitive' } },
            { nameAr: { contains: cleaned, mode: 'insensitive' } },
          ],
        }
      : { nameAr: { contains: cleaned, mode: 'insensitive' } },
    take: limit,
    orderBy: { nameAr: 'asc' },
  });

  for (const wb of webteb) {
    const cached = await prisma.foodItem.findUnique({ where: { webtebId: wb.webtebId } });
    if (cached) {
      addRow(cached, 0.75);
      continue;
    }
    addRow(
      {
        id: `webteb:${wb.webtebId}`,
        name: wb.nameEn || wb.nameAr,
        nameAr: wb.nameAr,
        webtebId: wb.webtebId,
        pendingWebteb: true,
      },
      0.72
    );
  }

  return [...seen.values()]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

async function importFoodFromWebtebId(webtebId) {
  const id = Number(webtebId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const existing = await prisma.foodItem.findUnique({ where: { webtebId: id } });
  if (existing) return existing;
  const webteb = await prisma.webtebFood.findUnique({ where: { webtebId: id } });
  if (!webteb) return null;
  return prisma.foodItem.create({
    data: {
      webtebId: webteb.webtebId,
      name: webteb.nameEn || webteb.nameAr,
      category: webteb.categorySlug || 'webteb',
      calories: webteb.calories,
      protein: webteb.protein,
      carbs: webteb.carbs,
      fat: webteb.fat,
      isPublic: true,
    },
  });
}

async function findFoodItemByQuery(query) {
  const candidates = await findFoodCandidates(query, { limit: 1 });
  const top = candidates[0];
  if (!top) return null;
  if (top.pendingWebteb && top.webtebId) {
    return importFoodFromWebtebId(top.webtebId);
  }
  return top;
}

/**
 * @param {string} text
 * @returns {Promise<{ foodItemId: string, grams: number, foodName: string, matchConfidence?: number }|{ needsDisambiguation: true, candidates: object[], grams: number }|null>}
 */
async function resolveFoodForLog(text) {
  const grams = parseGramsFromText(text) ?? DEFAULT_GRAMS;
  const candidates = await findFoodCandidates(text, { limit: 5 });
  if (!candidates.length) return null;

  const top = candidates[0];
  const second = candidates[1];
  const lowConfidence = top.confidence < 0.75;
  const ambiguous = second && top.confidence - second.confidence < 0.12;

  if ((lowConfidence || ambiguous) && candidates.length > 1) {
    const choices = [];
    for (const c of candidates.slice(0, 3)) {
      if (c.pendingWebteb && c.webtebId) {
        choices.push({
          webtebId: c.webtebId,
          foodName: c.name,
          nameAr: c.nameAr,
          confidence: c.confidence,
          grams,
        });
        continue;
      }
      if (c.id && !String(c.id).startsWith('webteb:')) {
        choices.push({
          foodItemId: c.id,
          foodName: c.name,
          nameAr: c.nameAr,
          confidence: c.confidence,
          grams,
        });
      }
    }
    if (choices.length > 1) {
      return { needsDisambiguation: true, candidates: choices, grams };
    }
    if (top.pendingWebteb && !choices.length) return null;
  }

  const food = await findFoodItemByQuery(text);
  if (!food) return null;
  return {
    foodItemId: food.id,
    grams,
    foodName: food.name,
    matchConfidence: top.confidence,
  };
}

async function resolveExerciseByName(name) {
  const n = String(name || '').trim();
  if (!n || n.length < 2) return null;

  const exact = await prisma.exercise.findFirst({
    where: {
      isPublic: true,
      OR: [
        { name: { equals: n, mode: 'insensitive' } },
        { nameAr: { equals: n, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, nameAr: true, category: true },
  });
  if (exact) return exact;

  const tokens = n.split(/\s+/).filter((t) => t.length >= 3);
  for (const token of tokens) {
    const fuzzy = await prisma.exercise.findFirst({
      where: {
        isPublic: true,
        OR: [
          { name: { contains: token, mode: 'insensitive' } },
          { nameAr: { contains: token, mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, nameAr: true, category: true },
    });
    if (fuzzy) return fuzzy;
  }

  return null;
}

function matchExerciseInTodayList(exercises, name) {
  const n = String(name || '').toLowerCase().trim();
  if (!n) return null;

  for (let i = 0; i < exercises.length; i += 1) {
    const row = exercises[i];
    const ex = row.exercise;
    const en = (ex?.name || '').toLowerCase();
    const ar = (ex?.nameAr || '').toLowerCase();

    if (en === n || ar === n || en.includes(n) || n.includes(en) || ar.includes(n) || n.includes(ar)) {
      return { index: i, exerciseId: row.exerciseId, name: ex?.name || ex?.nameAr };
    }

    for (const token of n.split(/\s+/)) {
      if (token.length < 3) continue;
      if (en.includes(token) || ar.includes(token)) {
        return { index: i, exerciseId: row.exerciseId, name: ex?.name || ex?.nameAr };
      }
    }
  }
  return null;
}

/**
 * @param {string} userId
 * @param {string} text
 * @returns {Promise<{ oldExerciseId?: string, newExerciseId: string, exerciseIndex?: number, reason?: string }>}
 */
async function resolveReplaceExerciseInputs(userId, text) {
  const resolved = await resolveTodayPlan(userId);
  if (!resolved.ok) throw new Error('No active plan for today');

  const dayId = resolved.dailyPlan?.workoutPlanDayId;
  if (!dayId) throw new Error('Today has no workout planned');

  const exercises = await prisma.workoutPlanExercise.findMany({
    where: { dayId },
    orderBy: { sortOrder: 'asc' },
    include: { exercise: { select: { id: true, name: true, nameAr: true } } },
  });
  if (!exercises.length) throw new Error('No exercises on today\'s workout');

  const { oldName, newName } = parseReplacePair(text);
  if (!newName && !oldName) {
    throw new Error('Could not parse which exercise to replace — name the exercise or use "replace X with Y"');
  }

  let oldExerciseId = null;
  let exerciseIndex = null;

  if (oldName) {
    const match = matchExerciseInTodayList(exercises, oldName);
    if (!match) {
      throw new Error(`Could not find "${oldName}" on today's workout`);
    }
    oldExerciseId = match.exerciseId;
    exerciseIndex = match.index;
  }

  const newQuery = newName || oldName;
  const newExercise = await resolveExerciseByName(newQuery);
  if (!newExercise) {
    throw new Error(`Could not find replacement exercise: "${newQuery}"`);
  }

  if (oldExerciseId && oldExerciseId === newExercise.id) {
    throw new Error('Replacement exercise is the same as the current one');
  }

  return {
    oldExerciseId: oldExerciseId || undefined,
    newExerciseId: newExercise.id,
    exerciseIndex: exerciseIndex ?? undefined,
    reason: text.slice(0, 500),
  };
}

const VALID_LIFE_MODES = ['normal', 'travel', 'sick', 'fasting', 'injury_flare'];

const LIFE_MODE_KEYWORDS = {
  travel: ['travel', 'traveling', 'trip', 'سفر', 'مسافر', 'مسافرة'],
  sick: ['sick', 'ill', 'cold', 'flu', 'مريض', 'مرض', 'زكام'],
  fasting: ['fasting', 'ramadan', 'رمضان', 'صيام', 'فطور'],
  injury_flare: ['injury', 'pain', 'hurt', 'flare', 'إصابة', 'ألم', 'وجع'],
  normal: ['normal', 'regular', 'عادي', 'طبيعي'],
};

/**
 * @param {string} text
 * @returns {string|null}
 */
function parseLifeModeFromText(text) {
  const raw = String(text || '').toLowerCase();
  if (!raw.trim()) return null;

  for (const [mode, keywords] of Object.entries(LIFE_MODE_KEYWORDS)) {
    if (keywords.some((k) => raw.includes(k.toLowerCase()))) return mode;
  }
  return null;
}

module.exports = {
  parseGramsFromText,
  stripActionVerbs,
  foodQueryFromText,
  parseReplacePair,
  parseLifeModeFromText,
  resolveFoodForLog,
  importFoodFromWebtebId,
  findFoodCandidates,
  scoreFoodRow,
  resolveReplaceExerciseInputs,
  resolveExerciseByName,
  matchExerciseInTodayList,
  VALID_LIFE_MODES,
  DEFAULT_GRAMS,
};
