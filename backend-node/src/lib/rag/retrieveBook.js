/**
 * @deprecated Prefer ragRetrieve({ purpose: 'plan_catalog', kind: 'book' }).
 * Coaching-book retrieval — L5 pgvector via unified ragRetrieve.
 */
const { ragRetrieve, formatBookChunkForPrompt } = require('./ragRetrieve');
const { buildContextTags, synthesizePlanQuery } = require('./ragQuery');

async function retrieveBookChunks({
  onboardingData,
  profile,
  message = '',
  limit = 4,
  traceId,
} = {}) {
  const query = synthesizePlanQuery({ kind: 'book', onboardingData, profile, message });
  const { items } = await ragRetrieve({
    purpose: 'plan_catalog',
    kind: 'book',
    query,
    onboardingData,
    profile,
    message,
    limit,
    traceId,
  });
  return items;
}

module.exports = {
  retrieveBookChunks,
  formatBookChunkForPrompt,
  buildContextTags,
};
