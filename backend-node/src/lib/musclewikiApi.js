/**
 * MuscleWiki official API client (requires MUSCLEWIKI_API_KEY).
 * @see https://api.musclewiki.com/documentation
 */

const BASE_URL = (process.env.MUSCLEWIKI_API_URL || 'https://api.musclewiki.com').replace(/\/$/, '');

function getApiKey() {
  const key = process.env.MUSCLEWIKI_API_KEY?.trim();
  if (!key) {
    throw new Error('MUSCLEWIKI_API_KEY is not set. Add it to backend-node/.env');
  }
  return key;
}

async function mwFetch(path, opts = {}) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Accept: 'application/json',
      'X-API-Key': getApiKey(),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text;
    try {
      const j = JSON.parse(text);
      detail = j.detail || j.message || text;
    } catch {
      /* keep text */
    }
    const err = new Error(`MuscleWiki API ${res.status}: ${detail}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

/** Paginated exercise list (minimal: id + name). */
async function listExercises({ limit = 100, offset = 0, ...filters } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  for (const [k, v] of Object.entries(filters)) {
    if (v != null && v !== '') params.set(k, String(v));
  }
  return mwFetch(`/exercises?${params}`);
}

/** Full exercise payload (steps, videos, muscles). */
async function getExercise(exerciseId) {
  return mwFetch(`/exercises/${exerciseId}`);
}

async function getCategories() {
  return mwFetch('/categories');
}

async function getMuscles() {
  return mwFetch('/muscles');
}

async function getStatistics() {
  return mwFetch('/statistics');
}

/** Stream URL builder (authenticated via our proxy). */
function streamVideoPath(filename) {
  return `/stream/videos/branded/${filename}`;
}

function streamOgImagePath(filename) {
  return `/stream/images/og_images/${filename}`;
}

/** Fetch raw video/image bytes (for import thumbnail probe or proxy). */
async function fetchStream(path, opts = {}) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'X-API-Key': getApiKey(),
      ...(opts.headers || {}),
    },
  });
  return res;
}

function normalizeExercise(raw) {
  const id = raw.id ?? raw.exercise_id;
  const name = raw.name || 'Exercise';
  const primaryMuscles = raw.primary_muscles ?? raw.primaryMuscles ?? raw.muscles ?? [];
  const secondaryMuscles = raw.secondary_muscles ?? raw.secondaryMuscles ?? [];
  const steps = Array.isArray(raw.steps) ? raw.steps : [];
  const videos = raw.videos ?? [];
  const category = raw.category?.name ?? raw.category ?? raw.equipment ?? 'bodyweight';
  const categoryStr = typeof category === 'string' ? category : String(category);

  let thumbnailUrl = raw.thumbnail_url ?? raw.thumbnailUrl ?? null;
  if (!thumbnailUrl && Array.isArray(videos) && videos.length > 0) {
    const v0 = videos[0];
    const og = v0.og_image ?? v0.ogImage ?? v0.thumbnail;
    if (og) {
      thumbnailUrl = og.startsWith('http') ? og : `${BASE_URL}${og.startsWith('/') ? og : `/${og}`}`;
    } else if (v0.filename) {
      thumbnailUrl = `${BASE_URL}${streamOgImagePath(`og-${v0.filename}`.replace(/^og-/, 'og-'))}`;
    }
  }

  const grips = raw.grips ?? null;
  const slug =
    raw.slug ??
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  return {
    muscleWikiId: Number(id),
    slug,
    name,
    category: categoryStr.toLowerCase(),
    difficulty: raw.difficulty ?? null,
    force: raw.force ?? null,
    mechanic: raw.mechanic ?? null,
    grips: grips == null ? null : grips,
    primaryMuscles: Array.isArray(primaryMuscles) ? primaryMuscles : [primaryMuscles],
    secondaryMuscles:
      secondaryMuscles == null
        ? null
        : Array.isArray(secondaryMuscles)
          ? secondaryMuscles
          : [secondaryMuscles],
    steps,
    videos,
    thumbnailUrl,
    longDescription: raw.long_description ?? raw.longDescription ?? raw.description ?? null,
    source: 'musclewiki',
    isPublic: true,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = {
  BASE_URL,
  getApiKey,
  mwFetch,
  listExercises,
  getExercise,
  getCategories,
  getMuscles,
  getStatistics,
  streamVideoPath,
  streamOgImagePath,
  fetchStream,
  normalizeExercise,
  sleep,
};
