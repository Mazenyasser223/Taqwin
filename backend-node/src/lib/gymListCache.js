/** Short-lived cache for public gym discovery list (reduces pool pressure on Supabase). */

const TTL_MS = Number(process.env.GYM_LIST_CACHE_TTL_MS) || 30_000;

let cachedPayload = null;
let cachedAt = 0;
let inflight = null;

async function getActiveGymList(fetcher) {
  const now = Date.now();
  if (cachedPayload && now - cachedAt < TTL_MS) {
    return cachedPayload;
  }
  if (inflight) return inflight;

  inflight = Promise.resolve()
    .then(fetcher)
    .then((payload) => {
      cachedPayload = payload;
      cachedAt = Date.now();
      return payload;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

function invalidateGymListCache() {
  cachedPayload = null;
  cachedAt = 0;
}

module.exports = { getActiveGymList, invalidateGymListCache };
