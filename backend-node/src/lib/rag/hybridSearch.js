/**
 * Tier 2 hybrid retrieval: pgvector cosine + Postgres FTS/trigram, fused with RRF.
 */
const { prisma } = require('../../db');
const { reciprocalRankFusion, fusedToResults, DEFAULT_RRF_K } = require('./rrf');
const { buildMetadataFilterSql, escapeSqlLiteral } = require('./metadataFilters');
const { isHybridSearchEnabled, hybridFetchMultiplier } = require('./ragConfig');

const TRIGRAM_MIN_SIM = Number(process.env.RAG_TRIGRAM_MIN_SIM || 0.12);

function mapVectorRow(row) {
  const distance = Number(row.distance);
  const score = Number.isFinite(distance) ? Math.max(0, 1 - distance) : 0;
  return {
    chunkId: row.chunk_id,
    documentId: row.document_id,
    level: row.level,
    source: row.source,
    title: row.title,
    locale: row.locale,
    content: row.content,
    metadata: row.metadata ?? null,
    parentId: row.parent_id ?? null,
    chunkRole: row.chunk_role ?? 'standalone',
    score,
    distance,
  };
}

function mapKeywordRow(row, rankScore) {
  return {
    chunkId: row.chunk_id,
    documentId: row.document_id,
    level: row.level,
    source: row.source,
    title: row.title,
    locale: row.locale,
    content: row.content,
    metadata: row.metadata ?? null,
    parentId: row.parent_id ?? null,
    chunkRole: row.chunk_role ?? 'standalone',
    score: Number(rankScore) || 0,
    keywordScore: Number(rankScore) || 0,
    distance: null,
  };
}

function buildLocaleClause(locale) {
  if (locale === 'en' || locale === 'ar') {
    return {
      clause: `AND (d.locale = '${locale}' OR d.locale = 'en')`,
      order: locale === 'ar'
        ? `CASE WHEN d.locale = 'ar' THEN 0 WHEN d.locale = 'en' THEN 1 ELSE 2 END, `
        : `CASE WHEN d.locale = 'en' THEN 0 WHEN d.locale = 'ar' THEN 1 ELSE 2 END, `,
    };
  }
  return { clause: '', order: '' };
}

/**
 * Resolve child hits to parent content for LLM context.
 * @param {object[]} results
 * @returns {Promise<object[]>}
 */
async function resolveParentContent(results) {
  const parentIds = [
    ...new Set(
      (results || [])
        .filter((r) => r.chunkRole === 'child' && r.parentId)
        .map((r) => r.parentId)
    ),
  ];
  if (!parentIds.length) return results;

  const idList = parentIds.map((id) => `'${escapeSqlLiteral(id)}'`).join(', ');
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, content, metadata
    FROM knowledge_chunks
    WHERE id IN (${idList})
  `);
  const parentById = new Map(rows.map((r) => [r.id, r]));

  return results.map((row) => {
    if (row.chunkRole !== 'child' || !row.parentId) return row;
    const parent = parentById.get(row.parentId);
    if (!parent) return row;
    return {
      ...row,
      content: parent.content || row.content,
      metadata: {
        ...(row.metadata || {}),
        resolvedFromChild: row.chunkId,
        childPreview: row.content?.slice(0, 200),
      },
    };
  });
}

async function searchVector({
  queryVector,
  levelList,
  take,
  locale,
  metadataFilters,
}) {
  const levelSql = levelList.map((l) => `'${l}'`).join(', ');
  const { clause: localeClause, order: localeOrder } = buildLocaleClause(locale);
  const metaClause = buildMetadataFilterSql(metadataFilters);

  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      k.id AS chunk_id,
      d.id AS document_id,
      d.level::text AS level,
      d.source,
      d.title,
      d.locale,
      k.content,
      k.metadata,
      k.parent_id,
      k.chunk_role,
      (k.embedding <=> '${queryVector}'::vector)::float8 AS distance
    FROM knowledge_chunks k
    INNER JOIN knowledge_documents d ON d.id = k.document_id
    WHERE k.embedding IS NOT NULL
      AND d.level IN (${levelSql})
      ${localeClause}
      ${metaClause}
    ORDER BY ${localeOrder}k.embedding <=> '${queryVector}'::vector
    LIMIT ${take}
  `);

  return rows.map(mapVectorRow);
}

async function searchKeyword({
  query,
  levelList,
  take,
  locale,
  metadataFilters,
}) {
  const levelSql = levelList.map((l) => `'${l}'`).join(', ');
  const { clause: localeClause } = buildLocaleClause(locale);
  const metaClause = buildMetadataFilterSql(metadataFilters);
  const q = escapeSqlLiteral(query.trim());

  const hybridLevels = levelList.filter((l) => l === 'L2_EXERCISE' || l === 'L3_NUTRITION');
  const useTrigramHeavy = hybridLevels.length > 0;

  const rows = await prisma.$queryRawUnsafe(`
    WITH ranked AS (
      SELECT
        k.id AS chunk_id,
        d.id AS document_id,
        d.level::text AS level,
        d.source,
        d.title,
        d.locale,
        k.content,
        k.metadata,
        k.parent_id,
        k.chunk_role,
        GREATEST(
          ts_rank_cd(COALESCE(k.search_vector, ''::tsvector), plainto_tsquery('simple', '${q}')),
          CASE WHEN COALESCE(k.search_vector, ''::tsvector) @@ plainto_tsquery('simple', '${q}') THEN 0.15 ELSE 0 END,
          ${useTrigramHeavy ? `similarity(k.content, '${q}')` : '0'},
          ${useTrigramHeavy ? `similarity(COALESCE(k.metadata->>'name', ''), '${q}')` : '0'},
          ${useTrigramHeavy ? `similarity(COALESCE(k.metadata->>'nameAr', ''), '${q}')` : '0'},
          CASE WHEN k.metadata->>'webtebId' = '${q}' THEN 1.0 ELSE 0 END,
          CASE WHEN k.metadata->>'exerciseId' = '${q}' THEN 1.0 ELSE 0 END,
          CASE WHEN k.metadata->>'foodItemId' = '${q}' THEN 1.0 ELSE 0 END
        )::float8 AS kw_score
      FROM knowledge_chunks k
      INNER JOIN knowledge_documents d ON d.id = k.document_id
      WHERE d.level IN (${levelSql})
        ${localeClause}
        ${metaClause}
        AND (
          COALESCE(k.search_vector, ''::tsvector) @@ plainto_tsquery('simple', '${q}')
          OR similarity(k.content, '${q}') > ${TRIGRAM_MIN_SIM}
          OR similarity(COALESCE(k.metadata->>'name', ''), '${q}') > ${TRIGRAM_MIN_SIM}
          OR similarity(COALESCE(k.metadata->>'nameAr', ''), '${q}') > ${TRIGRAM_MIN_SIM}
          OR k.metadata->>'webtebId' = '${q}'
          OR k.metadata->>'exerciseId' = '${q}'
          OR k.metadata->>'foodItemId' = '${q}'
        )
    )
    SELECT * FROM ranked
    WHERE kw_score > 0
    ORDER BY kw_score DESC
    LIMIT ${take}
  `);

  return rows.map((row) => mapKeywordRow(row, row.kw_score));
}

/**
 * Hybrid search with RRF fusion.
 * @param {object} opts
 * @param {string} opts.queryVector - pgvector literal
 * @param {string} opts.query - raw query text
 * @param {string[]} opts.levelList
 * @param {number} opts.take
 * @param {string} [opts.locale]
 * @param {object} [opts.metadataFilters]
 * @param {number} [opts.rrfK]
 */
async function hybridSearchKnowledge({
  queryVector,
  query,
  levelList,
  take,
  locale,
  metadataFilters,
  rrfK = DEFAULT_RRF_K,
}) {
  const fetchK = Math.min(Math.max(take * hybridFetchMultiplier(), take), 50);

  const [vectorResults, keywordResults] = await Promise.all([
    searchVector({ queryVector, levelList, take: fetchK, locale, metadataFilters }),
    searchKeyword({ query, levelList, take: fetchK, locale, metadataFilters }),
  ]);

  const fused = reciprocalRankFusion([vectorResults, keywordResults], { k: rrfK });
  let results = fusedToResults(fused).slice(0, take);
  results = await resolveParentContent(results);
  return { results, vectorCount: vectorResults.length, keywordCount: keywordResults.length };
}

function shouldUseHybrid(levelList) {
  if (!isHybridSearchEnabled()) return false;
  return levelList.some((l) => l === 'L2_EXERCISE' || l === 'L3_NUTRITION' || l === 'L1_INTERNAL' || l === 'L5_BOOKS');
}

module.exports = {
  hybridSearchKnowledge,
  resolveParentContent,
  searchVector,
  searchKeyword,
  shouldUseHybrid,
  mapVectorRow,
};
