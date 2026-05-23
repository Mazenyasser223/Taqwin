/**
 * MuscleWiki public Next.js API (api-next) — full exercise catalog (~1900+).
 * Requires Playwright browser context (Cloudflare / session cookies).
 */
const { SITE_BASE, sleep } = require('./musclewikiScraper');

const API = `${SITE_BASE}/api-next`;

/** Body-map / filter muscles (MuscleWiki primary groups). */
const BODY_MAP_MUSCLES = [
  'Abdominals',
  'Biceps',
  'Calves',
  'Chest',
  'Forearms',
  'Glutes',
  'Hamstrings',
  'Lats',
  'Lower back',
  'Obliques',
  'Quads',
  'Shoulders',
  'Traps',
  'Traps (mid-back)',
  'Triceps',
];

function slugify(name) {
  return String(name || 'exercise')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function muscleNames(list) {
  if (!Array.isArray(list)) return [];
  return list.map((m) => (typeof m === 'string' ? m : m?.name_en_us || m?.name)).filter(Boolean);
}

function parseVideosFromImages(images) {
  const videos = [];
  const male = images?.male ?? [];
  for (const img of male) {
    const url = img?.branded_video;
    if (!url || !url.includes('.mp4')) continue;
    const filename = url.split('/').pop() || 'video.mp4';
    const lower = filename.toLowerCase();
    videos.push({
      url: url.split('#')[0],
      filename,
      gender: 'male',
      angle: lower.includes('side') ? 'side' : 'front',
      type: 'mp4',
    });
  }
  return videos;
}

function stringDescription(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const t = raw.trim();
    return t.length ? t : null;
  }
  if (typeof raw.long_form_content === 'string') {
    const t = raw.long_form_content.trim();
    return t.length ? t : null;
  }
  return null;
}

function parseSteps(correctSteps) {
  if (!Array.isArray(correctSteps)) return [];
  return correctSteps
    .map((s) => {
      if (typeof s === 'string') return s.trim();
      const text = s?.text ?? s?.description ?? s?.step ?? '';
      const order = s?.order ?? s?.step_number;
      if (order != null && text) return `Step:${order} ${text}`.trim();
      return String(text).trim();
    })
    .filter((t) => t.length > 4);
}

/** Normalize api-next exercise row → Prisma Exercise shape. */
function normalizeApiNextExercise(raw) {
  const id = Number(raw.id);
  const name = raw.name_en_us || raw.name || 'Exercise';
  const slug = raw.slug || slugify(name);
  const primaryMuscles = muscleNames(raw.muscles_primary?.length ? raw.muscles_primary : raw.muscles);
  const secondaryMuscles = muscleNames(raw.muscles_secondary);
  const tertiary = muscleNames(raw.muscles_tertiary);
  const allSecondary = [...new Set([...secondaryMuscles, ...tertiary])];

  const categoryObj = raw.category;
  const category = (
    typeof categoryObj === 'string' ? categoryObj : categoryObj?.name_en_us || categoryObj?.name || 'bodyweight'
  ).toLowerCase();

  const videos = parseVideosFromImages(raw.images);
  const thumb =
    raw.images?.male?.[0]?.og_image ??
    raw.male_images?.[0]?.og_image ??
    null;

  const difficulty =
    typeof raw.difficulty === 'string' ? raw.difficulty : raw.difficulty?.name_en_us || raw.difficulty?.name || null;
  const force = typeof raw.force === 'string' ? raw.force : raw.force?.name_en_us || raw.force?.name || null;
  const mechanic =
    typeof raw.mechanic === 'string' ? raw.mechanic : raw.mechanic?.name_en_us || raw.mechanic?.name || null;

  let grips = null;
  if (Array.isArray(raw.grips) && raw.grips.length) {
    grips = raw.grips.map((g) => g?.name_en_us || g?.name).filter(Boolean);
  }

  return {
    muscleWikiId: id,
    slug,
    name,
    category,
    difficulty,
    force,
    mechanic,
    grips,
    primaryMuscles: primaryMuscles.length ? primaryMuscles : ['General'],
    secondaryMuscles: allSecondary.length ? allSecondary : null,
    steps: parseSteps(raw.correct_steps),
    videos,
    thumbnailUrl: thumb,
    longDescription:
      stringDescription(raw.description_en_us) ||
      stringDescription(raw.description) ||
      stringDescription(raw.long_form_content) ||
      null,
    source: 'musclewiki-apinext',
    isPublic: true,
  };
}

async function createMuscleWikiBrowser(opts = {}) {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    throw new Error('Playwright required: npm install playwright && npx playwright install chromium');
  }
  const browser = await chromium.launch({ headless: opts.headless !== false });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'en-US',
  });
  const page = await context.newPage();
  await page.goto(SITE_BASE, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(opts.warmupMs ?? 3000);
  return { browser, context, page };
}

async function fetchApiNext(page, pathQuery) {
  const path = pathQuery.startsWith('/') ? pathQuery : `/${pathQuery}`;
  return page.evaluate(async (p) => {
    const r = await fetch(`https://musclewiki.com${p}`, { credentials: 'include' });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`api-next ${r.status}: ${text.slice(0, 120)}`);
    }
    return r.json();
  }, path);
}

/** Paginate full exercise catalog from api-next. */
async function fetchAllApiNextExercises(page, opts = {}) {
  const pageSize = opts.pageSize ?? 100;
  const maxPages = opts.maxPages ?? 0;
  const delayMs = opts.delayMs ?? 200;
  const all = [];
  let offset = 0;
  let total = Infinity;
  let pageNum = 0;

  while (offset < total) {
    const data = await fetchApiNext(
      page,
      `/api-next/exercises?limit=${pageSize}&offset=${offset}&status=Published`,
    );
    total = data.count ?? total;
    const rows = data.results ?? [];
    if (!rows.length) break;
    all.push(...rows);
    offset += rows.length;
    pageNum += 1;
    if (opts.onPage) opts.onPage({ offset, total, batch: rows.length, accumulated: all.length });
    if (maxPages > 0 && pageNum >= maxPages) break;
    if (offset >= total) break;
    await sleep(delayMs);
  }

  return { exercises: all, total: total === Infinity ? all.length : total };
}

function primaryMuscleKey(ex) {
  const prim = ex.muscles_primary?.[0] ?? ex.muscles?.find((m) => m?.level === 0) ?? ex.muscles?.[0];
  return prim?.name_en_us || prim?.name || 'General';
}

/** Group raw api-next rows by primary body-map muscle. */
function groupExercisesByMuscle(rawExercises, muscleFilter = null) {
  const byMuscle = new Map();
  for (const raw of rawExercises) {
    const key = primaryMuscleKey(raw);
    if (muscleFilter && key.toLowerCase() !== muscleFilter.toLowerCase()) continue;
    if (!byMuscle.has(key)) byMuscle.set(key, []);
    byMuscle.get(key).push(raw);
  }
  return byMuscle;
}

/**
 * Scrape catalog muscle-by-muscle (iterates body-map muscles, filters catalog).
 * Returns normalized exercises (deduped by muscleWikiId).
 */
async function scrapeExercisesByMuscle(opts = {}) {
  const { browser, page } = await createMuscleWikiBrowser(opts);
  try {
    const { exercises: raw, total } = await fetchAllApiNextExercises(page, {
      pageSize: opts.pageSize ?? 100,
      maxPages: opts.maxPages ?? 0,
      delayMs: opts.delayMs ?? 200,
      onPage: opts.onPage,
    });
    console.log(`[apinext] fetched ${raw.length} exercises (api total ${total})`);

    const discovered = [...new Set(raw.map(primaryMuscleKey))].sort();
    const musclesToProcess = opts.muscle
      ? [opts.muscle]
      : discovered.length
        ? discovered
        : BODY_MAP_MUSCLES;

    const merged = new Map();
    const muscleStats = [];

    for (const muscle of musclesToProcess) {
      const rows = groupExercisesByMuscle(raw, muscle).get(muscle) ?? [];
      if (!rows.length && !opts.muscle) continue;

      let added = 0;
      for (const r of rows) {
        const norm = normalizeApiNextExercise(r);
        if (opts.limitPerMuscle > 0 && added >= opts.limitPerMuscle) break;
        if (!merged.has(norm.muscleWikiId)) {
          merged.set(norm.muscleWikiId, norm);
          added += 1;
        }
      }
      muscleStats.push({ muscle, count: rows.length, imported: added });
      console.log(`[apinext] ${muscle}: ${rows.length} exercises (${added} new)`);
      if (opts.delayMs) await sleep(opts.delayMs);
    }

    let list = [...merged.values()];
    if (opts.limit > 0) list = list.slice(0, opts.limit);

    return { exercises: list, muscleStats, rawCount: raw.length };
  } finally {
    await browser.close();
  }
}

module.exports = {
  API,
  BODY_MAP_MUSCLES,
  normalizeApiNextExercise,
  createMuscleWikiBrowser,
  fetchApiNext,
  fetchAllApiNextExercises,
  groupExercisesByMuscle,
  scrapeExercisesByMuscle,
  primaryMuscleKey,
  parseVideosFromImages,
};
