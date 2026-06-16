/**
 * Metadata-aware SQL filters for RAG retrieval (chat + catalog).
 * Filters apply during search, not only post-retrieval.
 */

const { buildAllergyFilters } = require('../plans/constraints');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function escapeSqlLiteral(value) {
  return String(value || '').replace(/'/g, "''");
}

function asStringList(arr) {
  if (!Array.isArray(arr)) return arr != null && arr !== '' ? [String(arr).trim()].filter(Boolean) : [];
  return arr.map((v) => String(v || '').trim()).filter(Boolean);
}

function resolveFoodAllergies(constraints, onboarding) {
  const raw =
    constraints.foodAllergies ||
    constraints.allergies ||
    constraints.allergens ||
    onboarding.foodAllergies ||
    onboarding.allergies ||
    [];
  return asStringList(raw).filter((a) => a && a !== 'none');
}

function resolveReligiousDiet(constraints, onboarding) {
  const raw = constraints.religiousDiet ?? onboarding.religiousDiet;
  const list = asStringList(raw).filter((r) => r && r !== 'none');
  const dietary = list.find(
    (r) => !['ramadan', 'christian_fasting'].includes(String(r).toLowerCase()),
  );
  return dietary || list[0] || '';
}

/**
 * @param {object} [filters]
 * @returns {string} SQL AND clauses (each prefixed with AND)
 */
function buildMetadataFilterSql(filters) {
  if (!filters || typeof filters !== 'object') return '';

  const clauses = [];

  const difficulties = asStringList(filters.difficulty);
  if (difficulties.length) {
    const vals = difficulties.map((d) => `'${escapeSqlLiteral(d.toLowerCase())}'`).join(', ');
    clauses.push(
      `(LOWER(k.metadata->>'difficulty') IN (${vals}) OR k.metadata->>'difficulty' IS NULL)`
    );
  }

  const excludeDifficulties = asStringList(filters.excludeDifficulty);
  if (excludeDifficulties.length) {
    const vals = excludeDifficulties.map((d) => `'${escapeSqlLiteral(d.toLowerCase())}'`).join(', ');
    clauses.push(
      `(k.metadata->>'difficulty' IS NULL OR LOWER(k.metadata->>'difficulty') NOT IN (${vals}))`
    );
  }

  const primaryMuscles = asStringList(filters.primaryMuscles);
  if (primaryMuscles.length) {
    const muscleClauses = primaryMuscles.map((m) => {
      const lit = escapeSqlLiteral(m.toLowerCase());
      return `(
        EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(COALESCE(k.metadata->'primaryMuscles', '[]'::jsonb)) AS pm(val)
          WHERE LOWER(pm.val) LIKE '%${lit}%'
        )
        OR LOWER(k.content) LIKE '%${lit}%'
        OR LOWER(k.metadata->>'name') LIKE '%${lit}%'
      )`;
    });
    clauses.push(`(${muscleClauses.join(' OR ')})`);
  }

  const excludeExerciseIds = asStringList(filters.excludeExerciseIds).filter((id) => UUID_RE.test(id));
  if (excludeExerciseIds.length) {
    const vals = excludeExerciseIds.map((id) => `'${escapeSqlLiteral(id)}'`).join(', ');
    clauses.push(`(k.metadata->>'exerciseId' IS NULL OR k.metadata->>'exerciseId' NOT IN (${vals}))`);
  }

  const dietType = String(filters.dietType || '').trim();
  if (dietType) {
    const lit = escapeSqlLiteral(dietType.toLowerCase());
    clauses.push(`(
      LOWER(k.content) LIKE '%${lit}%'
      OR LOWER(k.metadata->>'category') LIKE '%${lit}%'
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(COALESCE(k.metadata->'dietTags', '[]'::jsonb)) AS dt(val)
        WHERE LOWER(dt.val) LIKE '%${lit}%'
      )
    )`);
  }

  const religiousDiet = String(filters.religiousDiet || '').trim();
  if (religiousDiet && religiousDiet !== 'none') {
    const lit = escapeSqlLiteral(religiousDiet.toLowerCase());
    clauses.push(`(
      LOWER(k.content) LIKE '%${lit}%'
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(COALESCE(k.metadata->'dietTags', '[]'::jsonb)) AS rd(val)
        WHERE LOWER(rd.val) LIKE '%${lit}%'
      )
    )`);
  }

  const excludeAllergens = asStringList(filters.excludeAllergens);
  if (excludeAllergens.length) {
    for (const allergen of excludeAllergens) {
      const lit = escapeSqlLiteral(allergen.toLowerCase());
      clauses.push(`LOWER(k.content) NOT LIKE '%${lit}%'`);
    }
  }

  const docType = String(filters.docType || '').trim();
  if (docType === 'platform') {
    clauses.push(`d.level = 'L1_INTERNAL'`);
    clauses.push(`COALESCE(d.metadata->>'docType', 'platform') = 'platform'`);
  } else if (docType === 'book') {
    clauses.push(`d.level = 'L5_BOOKS'`);
  }

  const excludeTags = asStringList(filters.excludeTags);
  if (excludeTags.length) {
    for (const tag of excludeTags) {
      const lit = escapeSqlLiteral(tag);
      clauses.push(`NOT (COALESCE(d.metadata->'tags', '[]'::jsonb) ? '${lit}')`);
    }
  }

  const chunkRoles = asStringList(filters.chunkRoles);
  if (chunkRoles.length) {
    const vals = chunkRoles.map((r) => `'${escapeSqlLiteral(r)}'`).join(', ');
    clauses.push(`k.chunk_role IN (${vals})`);
  } else {
    // Default: searchable chunks only (child + standalone, not parent storage rows)
    clauses.push(`k.chunk_role IN ('child', 'standalone')`);
  }

  if (filters.requireEmbedding === true) {
    clauses.push(`k.embedding IS NOT NULL`);
  }

  const embeddingModel = String(filters.embeddingModel || '').trim();
  if (embeddingModel) {
    clauses.push(`k.embedding_model = '${escapeSqlLiteral(embeddingModel)}'`);
  }

  const embeddingVersion = String(filters.embeddingVersion || '').trim();
  if (embeddingVersion) {
    clauses.push(`k.embedding_version = '${escapeSqlLiteral(embeddingVersion)}'`);
  }

  const localeFilter = String(filters.locale || '').trim();
  if (localeFilter === 'en' || localeFilter === 'ar') {
    clauses.push(`(d.locale = '${escapeSqlLiteral(localeFilter)}' OR d.locale = 'en')`);
  }

  return clauses.length ? clauses.map((c) => `AND ${c}`).join('\n      ') : '';
}

/**
 * Build metadata filters from chat intent + CAG bundle (mirrors ai-service metadata_filters.py).
 * @param {{ intent?: string, contextBundle?: object, locale?: string }} opts
 * @returns {object|null}
 */
function buildChatMetadataFilters({ intent, contextBundle, locale } = {}) {
  const bundle = contextBundle || {};
  const constraints = bundle.constraints || {};
  const onboarding = bundle.onboardingSummary || bundle.onboardingByFlow?.nutrition || {};
  const profile = bundle.profile || {};

  const filters = {
    chunkRoles: ['child', 'standalone'],
    requireEmbedding: true,
  };

  const resolvedIntent = String(intent || 'general');

  if (resolvedIntent === 'platform_help' || resolvedIntent === 'unclear') {
    filters.docType = 'platform';
    filters.excludeTags = ['catalog', 'books'];
    if (locale === 'en' || locale === 'ar') {
      filters.locale = locale;
    }
    return filters;
  }

  if (resolvedIntent === 'exercise_alternative' || resolvedIntent === 'workout') {
    const level = String(profile.fitnessLevel || onboarding.fitnessLevel || '').toLowerCase();
    if (level.includes('beginner') || level.includes('novice')) {
      filters.difficulty = ['beginner'];
      filters.excludeDifficulty = ['advanced'];
    } else if (level.includes('advanced') || level.includes('expert')) {
      filters.difficulty = ['intermediate', 'advanced'];
    } else if (level) {
      filters.difficulty = ['beginner', 'intermediate'];
    }

    const injuries = Array.isArray(constraints.injuries)
      ? constraints.injuries.filter((i) => i && i !== 'none')
      : [];
    if (injuries.length) {
      filters.excludeExerciseNames = injuries.map(String);
    }

    const workoutToday = bundle.workoutToday || {};
    const exercises = workoutToday.exercises || workoutToday.loggedExercises || [];
    if (Array.isArray(exercises) && exercises.length) {
      const first = exercises[0];
      const muscles =
        first?.primaryMuscles ||
        first?.muscles ||
        (first?.muscleGroup ? [first.muscleGroup] : []);
      if (Array.isArray(muscles) && muscles.length) {
        filters.primaryMuscles = muscles.map(String);
      }
    }
    return filters;
  }

  if (resolvedIntent === 'nutrition') {
    const dietType =
      constraints.dietType ||
      onboarding.dietType ||
      bundle.onboardingByFlow?.nutrition?.dietType;
    if (dietType) filters.dietType = String(dietType);

    const religiousDiet = resolveReligiousDiet(constraints, onboarding);
    if (religiousDiet) filters.religiousDiet = String(religiousDiet);

    const allergyOnboarding = {
      foodAllergies: resolveFoodAllergies(constraints, onboarding),
      foodAllergiesOther:
        constraints.foodAllergiesOther ||
        onboarding.foodAllergiesOther ||
        onboarding.allergiesOther ||
        null,
    };
    const allergyFilters = buildAllergyFilters(allergyOnboarding);
    if (allergyFilters.active) {
      filters.excludeAllergens = allergyFilters.keywords.slice(0, 24);
      filters.allergyCodes = allergyFilters.codes;
    }
    return filters;
  }

  return Object.keys(filters).length > 2 ? filters : null;
}

module.exports = {
  buildMetadataFilterSql,
  buildChatMetadataFilters,
  escapeSqlLiteral,
};
