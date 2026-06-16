/**
 * Exercise library search — ranked keyword + pg_trgm fuzzy matching.
 */
const { Prisma } = require('../../generated/prisma');

const TRIGRAM_MIN_SIM = Number(process.env.EXERCISE_SEARCH_TRIGRAM_MIN_SIM || 0.18);
const MIN_QUERY_LEN = 2;
const MAX_SEARCH_TERMS = 8;

/** Synonym groups: any member can match a user token. */
const SYNONYM_GROUPS = [
  ['bench', 'benchpress', 'chest', 'pec', 'pectorals'],
  ['press', 'pressing', 'overhead'],
  ['curl', 'curls', 'biceps', 'bicep'],
  ['tricep', 'triceps', 'extension', 'pushdown', 'skullcrusher'],
  ['squat', 'squats', 'quads', 'quad', 'leg'],
  ['deadlift', 'deadlifts', 'dl'],
  ['row', 'rows', 'rowing'],
  ['pulldown', 'pull down', 'lat', 'lats'],
  ['pullup', 'pull up', 'pullups', 'chinup', 'chin up', 'chinups'],
  ['pushup', 'push up', 'pushups', 'push ups'],
  ['fly', 'flye', 'flyes', 'flies', 'pec deck'],
  ['raise', 'raises', 'lateral'],
  ['shrug', 'shrugs', 'trap', 'traps'],
  ['crunch', 'crunches', 'abs', 'ab', 'core'],
  ['plank', 'planks'],
  ['lunge', 'lunges'],
  ['hip', 'thrust', 'glute', 'glutes'],
  ['calf', 'calves'],
  ['hamstring', 'hamstrings', 'rdl', 'romanian'],
  ['shoulder', 'shoulders', 'delt', 'deltoid'],
  ['forearm', 'forearms', 'wrist', 'hand', 'hands', 'grip', 'finger', 'fingers'],
  ['oblique', 'obliques'],
  ['stretch', 'stretches', 'mobility'],
  ['dumbbell', 'db', 'dumbbells'],
  ['barbell', 'bb', 'bar'],
  ['cable', 'cables'],
  ['machine', 'machines'],
];

const ARABIC_MUSCLE_ALIASES = {
  صدر: ['chest', 'bench', 'pec', 'push'],
  ظهر: ['back', 'lat', 'row', 'pull'],
  'عضله ظهر': ['lat', 'back', 'row'],
  باي: ['biceps', 'curl', 'bicep'],
  'باي سيب': ['triceps', 'tricep', 'pushdown'],
  три: ['triceps', 'tricep'],
  كتف: ['shoulder', 'delt', 'press', 'raise'],
  اكتاف: ['shoulder', 'delt'],
  رجل: ['leg', 'squat', 'quad', 'lunge'],
  رجلين: ['leg', 'squat', 'quad'],
  فخذ: ['quad', 'squat', 'leg'],
  'خلفيه': ['hamstring', 'glute', 'rdl'],
  سمانه: ['calf', 'calves'],
  ارداف: ['glute', 'hip', 'thrust'],
  بطن: ['abs', 'ab', 'crunch', 'core', 'plank'],
  'ذراع': ['arm', 'curl', 'biceps', 'triceps'],
};

const ZONE_ALIASES = {
  chest: ['chest', 'bench', 'pec', 'صدر'],
  lats: ['lat', 'lats', 'pulldown', 'pullup', 'row'],
  biceps: ['biceps', 'bicep', 'curl', 'باي'],
  triceps: ['triceps', 'tricep', 'pushdown'],
  shoulders: ['shoulder', 'delt', 'press', 'كتف'],
  quads: ['quad', 'squat', 'leg', 'فخذ'],
  hamstrings: ['hamstring', 'rdl', 'leg curl'],
  glutes: ['glute', 'hip thrust', 'ارداف'],
  abs: ['abs', 'crunch', 'plank', 'بطن'],
  traps: ['trap', 'shrug', 'neck'],
  trapsmiddle: ['mid back', 'trap', 'scapular'],
  forearms: ['forearm', 'wrist', 'hand', 'grip', 'finger', 'ساعد', 'يد'],
};

function normalizeArabic(text) {
  return String(text || '')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

function normalizeText(raw) {
  let s = String(raw || '').trim().toLowerCase();
  if (/[\u0600-\u06FF]/.test(s)) s = normalizeArabic(s);
  s = s
    .replace(/[-_/]+/g, ' ')
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

function compactToken(token) {
  return String(token || '').replace(/\s+/g, '');
}

function expandToken(token) {
  const normalized = normalizeText(token);
  const compact = compactToken(normalized);
  if (!normalized) return [];

  const variants = new Set([normalized, compact]);

  for (const group of SYNONYM_GROUPS) {
    const hit = group.some((g) => {
      const gn = normalizeText(g);
      const gc = compactToken(gn);
      return normalized === gn || compact === gc || normalized.includes(gn) || gn.includes(normalized);
    });
    if (hit) {
      for (const g of group) {
        variants.add(normalizeText(g));
        variants.add(compactToken(g));
      }
    }
  }

  for (const [ar, enList] of Object.entries(ARABIC_MUSCLE_ALIASES)) {
    const arN = normalizeArabic(ar);
    if (normalized.includes(arN) || arN.includes(normalized)) {
      for (const en of enList) {
        variants.add(normalizeText(en));
        variants.add(compactToken(en));
      }
    }
  }

  for (const aliases of Object.values(ZONE_ALIASES)) {
    if (aliases.some((a) => normalizeText(a) === normalized || compactToken(a) === compact)) {
      for (const a of aliases) {
        variants.add(normalizeText(a));
        variants.add(compactToken(a));
      }
    }
  }

  return [...variants].filter((v) => v.length >= 2).slice(0, 12);
}

function tokenizeQuery(raw) {
  const normalized = normalizeText(raw);
  if (!normalized) return [];
  const parts = normalized.split(/\s+/).filter((t) => t.length >= 2);
  return parts.slice(0, MAX_SEARCH_TERMS);
}

function buildFilterSql(filters = {}) {
  const parts = [Prisma.sql`e.is_public = true`];

  if (filters.browseMuscleZone) {
    parts.push(Prisma.sql`e.browse_muscle_zone = ${filters.browseMuscleZone}`);
  }
  if (filters.category) {
    parts.push(Prisma.sql`e.category = ${filters.category}`);
  }
  if (filters.categoriesIn?.length) {
    parts.push(
      Prisma.sql`e.category IN (${Prisma.join(filters.categoriesIn.map((c) => Prisma.sql`${c}`))})`
    );
  }
  if (filters.categoriesNotIn?.length) {
    parts.push(
      Prisma.sql`e.category NOT IN (${Prisma.join(filters.categoriesNotIn.map((c) => Prisma.sql`${c}`))})`
    );
  }
  if (filters.wikiLabels?.length) {
    parts.push(
      Prisma.sql`e.primary_muscles ?| ARRAY[${Prisma.join(filters.wikiLabels.map((l) => Prisma.sql`${l}`))}]::text[]`
    );
  }
  if (filters.difficulty) {
    parts.push(Prisma.sql`e.difficulty = ${filters.difficulty}`);
  }
  if (filters.goals?.length) {
    parts.push(
      Prisma.sql`e.fitness_goals && ARRAY[${Prisma.join(filters.goals.map((g) => Prisma.sql`${g}`))}]::text[]`
    );
  }
  if (filters.savedUserId) {
    parts.push(Prisma.sql`EXISTS (
      SELECT 1 FROM saved_exercises se
      WHERE se.exercise_id = e.id AND se.user_id = ${filters.savedUserId}
    )`);
  }

  return Prisma.join(parts, ' AND ');
}

function termMatchSql(termVariants) {
  const ors = termVariants.map(
    (v) => Prisma.sql`(c.search_blob LIKE ${`%${v}%`})`
  );
  return Prisma.sql`(${Prisma.join(ors, ' OR ')})`;
}

function searchBlobExpr() {
  return Prisma.sql`lower(
    coalesce(e.name, '') || ' ' ||
    coalesce(e.name_ar, '') || ' ' ||
    coalesce(e.category, '') || ' ' ||
    coalesce(e.browse_muscle_zone, '') || ' ' ||
    coalesce(e.slug, '') || ' ' ||
    coalesce(e.primary_muscles::text, '') || ' ' ||
    coalesce(e.secondary_muscles::text, '')
  )`;
}

function scoreExpr(normalizedFull) {
  return Prisma.sql`(
    CASE WHEN lower(c.name) = ${normalizedFull} THEN 1000 ELSE 0 END +
    CASE WHEN lower(coalesce(c.name_ar, '')) = ${normalizedFull} THEN 980 ELSE 0 END +
    CASE WHEN lower(c.name) LIKE ${`${normalizedFull}%`} THEN 800 ELSE 0 END +
    CASE WHEN lower(c.name) ILIKE ${`%${normalizedFull}%`} THEN 500 ELSE 0 END +
    CASE WHEN lower(coalesce(c.name_ar, '')) ILIKE ${`%${normalizedFull}%`} THEN 450 ELSE 0 END +
    CASE WHEN c.search_blob ILIKE ${`%${normalizedFull.replace(/\s+/g, '')}%`} THEN 200 ELSE 0 END +
    GREATEST(
      similarity(lower(c.name), ${normalizedFull}),
      similarity(lower(coalesce(c.name_ar, '')), ${normalizedFull}),
      word_similarity(${normalizedFull}, lower(c.name)),
      word_similarity(${normalizedFull}, lower(coalesce(c.name_ar, '')))
    ) * 250
  )::float`;
}

/**
 * @param {import('../../generated/prisma').PrismaClient} prisma
 * @param {{ query: string, locale?: string, filters?: object, pageSize: number, offset: number }} opts
 * @returns {Promise<{ rows: object[], total: number } | null>}
 */
async function searchExercises(prisma, { query, filters = {}, pageSize, offset }) {
  const rawQuery = String(query || '').trim();
  if (rawQuery.length < MIN_QUERY_LEN) return null;

  const normalizedFull = normalizeText(rawQuery);
  const tokens = tokenizeQuery(rawQuery);
  if (!normalizedFull || !tokens.length) return null;

  const filterSql = buildFilterSql(filters);
  const blobExpr = searchBlobExpr();

  const termClauses = tokens.map((token) => termMatchSql(expandToken(token)));
  const keywordMatch =
    termClauses.length === 1
      ? termClauses[0]
      : Prisma.sql`(${Prisma.join(termClauses, ' AND ')})`;

  const fuzzyMatch = Prisma.sql`(
    similarity(lower(c.name), ${normalizedFull}) >= ${TRIGRAM_MIN_SIM}
    OR word_similarity(${normalizedFull}, lower(c.name)) >= ${TRIGRAM_MIN_SIM}
    OR similarity(lower(coalesce(c.name_ar, '')), ${normalizedFull}) >= ${TRIGRAM_MIN_SIM}
    OR word_similarity(${normalizedFull}, lower(coalesce(c.name_ar, ''))) >= ${TRIGRAM_MIN_SIM}
  )`;

  const whereMatch = Prisma.sql`(${keywordMatch} OR ${fuzzyMatch})`;
  const scoreSql = scoreExpr(normalizedFull);

  const rows = await prisma.$queryRaw`
    WITH candidates AS (
      SELECT e.*, ${blobExpr} AS search_blob
      FROM exercises e
      WHERE ${filterSql}
    ),
    scored AS (
      SELECT c.*, ${scoreSql} AS search_score
      FROM candidates c
      WHERE ${whereMatch}
    )
    SELECT * FROM scored
    WHERE search_score >= 15
    ORDER BY search_score DESC, name ASC
    LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}
  `;

  const countRows = await prisma.$queryRaw`
    WITH candidates AS (
      SELECT e.*, ${blobExpr} AS search_blob
      FROM exercises e
      WHERE ${filterSql}
    ),
    scored AS (
      SELECT c.*, ${scoreSql} AS search_score
      FROM candidates c
      WHERE ${whereMatch}
    )
    SELECT COUNT(*)::int AS count FROM scored WHERE search_score >= 15
  `;

  return {
    rows,
    total: Number(countRows[0]?.count ?? 0),
  };
}

module.exports = {
  TRIGRAM_MIN_SIM,
  MIN_QUERY_LEN,
  normalizeText,
  tokenizeQuery,
  expandToken,
  buildFilterSql,
  searchExercises,
};
