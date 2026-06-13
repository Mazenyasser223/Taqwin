/**
 * Reciprocal Rank Fusion (RRF) for merging vector + keyword ranked lists.
 * score(d) = sum 1 / (k + rank(d)) across each list.
 */

const DEFAULT_RRF_K = Number(process.env.RAG_RRF_K || 60);

/**
 * @param {Array<{ chunkId: string, [key: string]: unknown }>} lists - ranked result arrays
 * @param {{ k?: number }} [opts]
 * @returns {Array<{ chunkId: string, rrfScore: number, sources: string[], row: object }>}
 */
function reciprocalRankFusion(lists, { k = DEFAULT_RRF_K } = {}) {
  const scores = new Map();

  for (let listIdx = 0; listIdx < lists.length; listIdx += 1) {
    const list = lists[listIdx] || [];
    const source = listIdx === 0 ? 'vector' : listIdx === 1 ? 'keyword' : `list${listIdx}`;
    for (let rank = 0; rank < list.length; rank += 1) {
      const row = list[rank];
      const chunkId = row?.chunkId;
      if (!chunkId) continue;
      const contrib = 1 / (k + rank + 1);
      const prev = scores.get(chunkId);
      if (prev) {
        prev.rrfScore += contrib;
        if (!prev.sources.includes(source)) prev.sources.push(source);
      } else {
        scores.set(chunkId, { chunkId, rrfScore: contrib, sources: [source], row });
      }
    }
  }

  return Array.from(scores.values()).sort((a, b) => b.rrfScore - a.rrfScore);
}

/**
 * Apply RRF scores back onto row objects for downstream minScore filtering.
 * @param {ReturnType<typeof reciprocalRankFusion>} fused
 * @returns {object[]}
 */
function fusedToResults(fused) {
  return fused.map(({ row, rrfScore, sources }) => ({
    ...row,
    score: rrfScore,
    rrfScore,
    retrievalSources: sources,
    distance: row.distance ?? null,
  }));
}

module.exports = {
  DEFAULT_RRF_K,
  reciprocalRankFusion,
  fusedToResults,
};
