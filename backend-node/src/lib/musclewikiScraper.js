/**
 * MuscleWiki web scraping (no official API key).
 *
 * 1) workoutapi.vercel.app — public mirror of scraped MuscleWiki exercise JSON (~700+).
 * 2) musclewiki.com — Playwright browser scrape when Cloudflare blocks plain fetch.
 *
 * Videos are stored as public CDN URLs (media.musclewiki.com) for client playback.
 */
const cheerio = require('cheerio');

const SITE_BASE = 'https://musclewiki.com';
const WORKOUT_API = 'https://workoutapi.vercel.app';
const MEDIA_CDN = 'https://media.musclewiki.com';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
  'Cache-Control': 'no-cache',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugify(name) {
  return String(name || 'exercise')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseVideoUrls(urls) {
  const list = Array.isArray(urls) ? urls : [];
  return list
    .map((raw) => {
      const url = String(raw).split('#')[0].trim();
      if (!url) return null;
      const filename = url.split('/').pop() || 'video.mp4';
      const lower = url.toLowerCase();
      return {
        url,
        filename,
        gender: lower.includes('female') ? 'female' : 'male',
        angle: lower.includes('side') ? 'side' : 'front',
      };
    })
    .filter(Boolean);
}

/** Normalize workoutapi.vercel.app exercise row. */
function normalizeWorkoutApiItem(item) {
  const id = Number(item.id);
  const name = item.exercise_name || item.name || 'Exercise';
  const primary = item.target?.Primary ?? item.target?.primary ?? [];
  const secondary = item.target?.Secondary ?? item.target?.secondary ?? [];
  const steps = Array.isArray(item.steps) ? item.steps : [];
  const videos = parseVideoUrls(item.videoURL ?? item.videoUrls ?? []);
  const category = String(item.Category || item.category || 'bodyweight').toLowerCase();
  const youtubeUrl =
    typeof item.youtubeURL === 'string' && item.youtubeURL.includes('youtube') ? item.youtubeURL : null;

  return {
    muscleWikiId: id,
    slug: slugify(name),
    name,
    category,
    difficulty: item.Difficulty ?? item.difficulty ?? null,
    force: item.Force ?? item.force ?? null,
    mechanic: item.mechanic ?? item.Mechanic ?? null,
    grips: item.Grips ? [item.Grips] : item.grips ?? null,
    primaryMuscles: Array.isArray(primary) ? primary : [primary].filter(Boolean),
    secondaryMuscles: Array.isArray(secondary) ? secondary : secondary ? [secondary] : null,
    steps,
    videos: youtubeUrl ? [...videos, { type: 'youtube', url: youtubeUrl }] : videos,
    thumbnailUrl: null,
    longDescription: typeof item.details === 'string' ? item.details.trim() : null,
    source: 'musclewiki-scrape',
    isPublic: true,
  };
}

/** Scrape catalog from public workoutapi mirror (prior MuscleWiki scrape). */
async function scrapeWorkoutApiCatalog() {
  const res = await fetch(`${WORKOUT_API}/exercises`, {
    headers: { Accept: 'application/json', ...BROWSER_HEADERS },
  });
  if (!res.ok) throw new Error(`workoutapi HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('workoutapi: unexpected response');
  return data.map(normalizeWorkoutApiItem);
}

function extractNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function parseExerciseHtml(html, url) {
  const $ = cheerio.load(html);
  const next = extractNextData(html);
  const pageProps = next?.props?.pageProps ?? next?.props?.pageProps?.exercise ?? null;

  let payload = pageProps?.exercise ?? pageProps ?? null;
  if (payload?.data) payload = payload.data;

  const name =
    payload?.name ??
    $('h1').first().text().trim() ??
    $('meta[property="og:title"]').attr('content')?.replace(/- MuscleWiki.*/i, '').trim();

  if (!name) return null;

  const stepsFromPayload = payload?.steps ?? payload?.instructions;
  let steps = [];
  if (Array.isArray(stepsFromPayload)) {
    steps = stepsFromPayload.map((s) => (typeof s === 'string' ? s : s?.text ?? String(s)));
  } else {
    $('ol li, [class*="step"] li, article li').each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (t.length > 8) steps.push(t);
    });
  }

  const videoUrls = [];
  $('video source[src], video[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src) videoUrls.push(src.startsWith('http') ? src : `${MEDIA_CDN}${src}`);
  });
  if (Array.isArray(payload?.videos)) {
    for (const v of payload.videos) {
      if (v?.url) videoUrls.push(v.url);
      if (v?.src) videoUrls.push(v.src);
    }
  }

  const slugFromUrl = url.match(/\/exercise\/([^/?#]+)/i)?.[1] ?? slugify(name);
  const primaryMuscles =
    payload?.primary_muscles ??
    payload?.muscles ??
    payload?.target?.Primary ??
    [];

  return {
    muscleWikiId: Number(payload?.id) || hashSlugToId(slugFromUrl),
    slug: slugFromUrl,
    name,
    category: String(payload?.category ?? payload?.Category ?? 'bodyweight').toLowerCase(),
    difficulty: payload?.difficulty ?? payload?.Difficulty ?? null,
    force: payload?.force ?? payload?.Force ?? null,
    mechanic: payload?.mechanic ?? payload?.Mechanic ?? null,
    grips: payload?.grips ?? (payload?.Grips ? [payload.Grips] : null),
    primaryMuscles: Array.isArray(primaryMuscles) ? primaryMuscles : [primaryMuscles].filter(Boolean),
    secondaryMuscles: payload?.secondary_muscles ?? payload?.target?.Secondary ?? null,
    steps,
    videos: parseVideoUrls(videoUrls),
    thumbnailUrl: $('meta[property="og:image"]').attr('content') ?? parseVideoUrls(videoUrls)[0]?.url ?? null,
    longDescription:
      payload?.description ??
      payload?.details ??
      ($('article').text().trim().slice(0, 8000) || null),
    source: 'musclewiki-scrape',
    isPublic: true,
  };
}

/** Stable numeric id from slug when MuscleWiki id missing in HTML. */
function hashSlugToId(slug) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return 900_000 + (h % 800_000);
}

async function fetchHtml(url) {
  const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/** Try plain HTTP fetch (works on some networks; often blocked by Cloudflare). */
async function scrapeExercisePageHttp(slug) {
  const url = `${SITE_BASE}/exercise/${slug}`;
  const html = await fetchHtml(url);
  return parseExerciseHtml(html, url);
}

/**
 * Playwright scrape: discover /exercise/* links and parse each page.
 * Requires: npm install playwright && npx playwright install chromium
 */
async function scrapeMuscleWikiSitePlaywright(opts = {}) {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    throw new Error('Playwright not installed. Run: npm install playwright && npx playwright install chromium');
  }

  const delayMs = opts.delayMs ?? 400;
  const limit = opts.limit ?? 0;
  const headless = opts.headless !== false;

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    userAgent: BROWSER_HEADERS['User-Agent'],
    locale: 'en-US',
  });
  const page = await context.newPage();

  const seedPaths = [
    '/exercises',
    '/directory',
    '/workouts',
    '/ar-sa/exercises',
    '/ar-sa/workouts',
  ];

  const linkSet = new Set();
  for (const path of seedPaths) {
    try {
      await page.goto(`${SITE_BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await page.waitForTimeout(2000);
      const hrefs = await page.$$eval('a[href*="/exercise/"]', (anchors) =>
        anchors.map((a) => a.getAttribute('href')).filter(Boolean),
      );
      for (const href of hrefs) {
        const m = href.match(/\/exercise\/([^/?#]+)/i);
        if (m) linkSet.add(m[1]);
      }
    } catch (err) {
      console.warn(`[scrape] seed ${path} skipped:`, err.message);
    }
  }

  const slugs = [...linkSet];
  console.log(`[scrape] Playwright discovered ${slugs.length} exercise URLs`);
  const results = [];
  const max = limit > 0 ? Math.min(limit, slugs.length) : slugs.length;

  for (let i = 0; i < max; i++) {
    const slug = slugs[i];
    const url = `${SITE_BASE}/exercise/${slug}`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await page.waitForTimeout(800);
      const html = await page.content();
      const parsed = parseExerciseHtml(html, url);
      if (parsed) results.push(parsed);
      if ((i + 1) % 20 === 0) console.log(`[scrape] site ${i + 1}/${max}`);
    } catch (err) {
      console.warn(`[scrape] ${slug}:`, err.message);
    }
    await sleep(delayMs);
  }

  await browser.close();
  return results;
}

/**
 * Full scrape: workoutapi mirror + optional Playwright site pass for extra slugs.
 */
async function scrapeAllExercises(opts = {}) {
  const merged = new Map();
  const workoutApi = await scrapeWorkoutApiCatalog();
  for (const ex of workoutApi) merged.set(ex.slug, ex);
  console.log(`[scrape] workoutapi mirror: ${workoutApi.length} exercises`);

  if (opts.site !== false) {
    try {
      const siteRows = await scrapeMuscleWikiSitePlaywright({
        delayMs: opts.delayMs,
        limit: opts.siteLimit ?? 0,
        headless: opts.headless,
      });
      for (const ex of siteRows) {
        if (!merged.has(ex.slug)) merged.set(ex.slug, ex);
      }
      console.log(`[scrape] site added ${siteRows.length} (unique total ${merged.size})`);
    } catch (err) {
      console.warn('[scrape] Playwright site pass skipped:', err.message);
      if (opts.requireSite) throw err;
    }
  }

  let list = [...merged.values()];
  if (opts.limit > 0) list = list.slice(0, opts.limit);
  return list;
}

module.exports = {
  scrapeWorkoutApiCatalog,
  scrapeMuscleWikiSitePlaywright,
  scrapeAllExercises,
  scrapeExercisePageHttp,
  parseExerciseHtml,
  normalizeWorkoutApiItem,
  sleep,
  SITE_BASE,
  WORKOUT_API,
};
