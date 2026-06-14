/**
 * Pre-confirm food disambiguation for coach chat pending actions.
 */
const {
  resolveFoodForLog,
  importFoodFromWebtebId,
  DEFAULT_GRAMS,
} = require('../aiToolResolvers');

function logFoodQueryFromInput(input = {}) {
  return String(input.foodName || input.rawText || input.message || '').trim();
}

function normalizeCandidate(row) {
  if (!row || typeof row !== 'object') return null;
  const grams = row.grams != null ? Number(row.grams) : DEFAULT_GRAMS;
  if (row.foodItemId) {
    return {
      foodItemId: String(row.foodItemId),
      foodName: row.foodName || '',
      nameAr: row.nameAr || null,
      grams,
    };
  }
  if (row.webtebId != null) {
    return {
      webtebId: Number(row.webtebId),
      foodName: row.foodName || '',
      nameAr: row.nameAr || null,
      grams,
    };
  }
  return null;
}

function serializeCandidates(candidates) {
  return (candidates || [])
    .map(normalizeCandidate)
    .filter(Boolean)
    .slice(0, 3);
}

function candidateDisplayName(candidate, locale) {
  const ar = locale === 'ar';
  if (ar && candidate.nameAr) return candidate.nameAr;
  return candidate.foodName || candidate.nameAr || '';
}

/**
 * @param {object} input
 * @returns {Promise<
 *   | { status: 'resolved', input: object }
 *   | { status: 'disambiguation', candidates: object[], grams: number, query: string }
 *   | { status: 'no_match', query: string }
 * >}
 */
async function preResolveLogFoodInput(input = {}) {
  if (input.foodItemId) {
    return { status: 'resolved', input };
  }

  const query = logFoodQueryFromInput(input);
  if (!query) {
    return { status: 'no_match', query: '' };
  }

  const resolved = await resolveFoodForLog(query);
  if (!resolved) {
    return { status: 'no_match', query };
  }
  if (resolved.needsDisambiguation) {
    return {
      status: 'disambiguation',
      candidates: serializeCandidates(resolved.candidates),
      grams: resolved.grams ?? DEFAULT_GRAMS,
      query,
    };
  }

  return {
    status: 'resolved',
    input: {
      ...input,
      foodItemId: resolved.foodItemId,
      foodName: resolved.foodName,
      grams: input.grams != null ? input.grams : resolved.grams,
      matchConfidence: resolved.matchConfidence,
      rawText: input.rawText || query,
    },
  };
}

/**
 * @param {{ foodItemId?: string, webtebId?: number }} pick
 */
async function resolveFoodPick(pick) {
  if (pick?.foodItemId) {
    return { foodItemId: String(pick.foodItemId), foodName: pick.foodName || null };
  }
  if (pick?.webtebId != null) {
    const food = await importFoodFromWebtebId(pick.webtebId);
    if (!food) return null;
    return { foodItemId: food.id, foodName: food.name };
  }
  return null;
}

function disambiguationReply(locale, query) {
  const detail = String(query || '').slice(0, 80);
  if (locale === 'ar') {
    return detail
      ? `في أكثر من أكل يطابق «${detail}». اختر واحد من القائمة:`
      : 'في أكثر من أكل يطابق طلبك. اختر واحد من القائمة:';
  }
  return detail
    ? `More than one food matches "${detail}". Pick one:`
    : 'More than one food matches your request. Pick one:';
}

function pendingForClient(pending) {
  if (!pending) return null;
  const base = {
    actionId: pending.actionId,
    phase: pending.phase || 'confirm',
    preview: pending.preview || '',
    tools: pending.tools || [],
    expiresAt: pending.expiresAt || null,
    locale: pending.locale === 'en' ? 'en' : 'ar',
  };
  if (pending.phase === 'disambiguation' && pending.disambiguation) {
    return {
      ...base,
      disambiguationRequired: true,
      disambiguationKind: pending.disambiguation.kind || 'food',
      candidates: serializeCandidates(pending.disambiguation.candidates),
      disambiguationQuery: pending.disambiguation.query || '',
    };
  }
  if (pending.phase === 'confirm') {
    const { stepUpClientFields } = require('./stepUpAuth');
    return {
      ...base,
      confirmationRequired: true,
      confirmationPreview: pending.preview || '',
      ...stepUpClientFields(pending),
    };
  }
  return base;
}

module.exports = {
  logFoodQueryFromInput,
  normalizeCandidate,
  serializeCandidates,
  candidateDisplayName,
  preResolveLogFoodInput,
  resolveFoodPick,
  disambiguationReply,
  pendingForClient,
};
