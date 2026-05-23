/**
 * Sync real MuscleWiki video URLs from exercise pages and cache MP4s locally.
 */
const fs = require('fs');
const path = require('path');
const {
  publicLocalUrl,
  localAbsolutePath,
  ensureDir,
  isValidMp4Buffer,
  isValidMp4File,
} = require('./exerciseVideoCache');

const SITE = 'https://musclewiki.com';
const MEDIA = 'https://media.musclewiki.com';

let browser = null;
let context = null;

function slugify(name) {
  return String(name || 'exercise')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function slugCandidates(exercise) {
  const fromName = slugify(exercise.name);
  const base = exercise.slug || fromName;
  const set = new Set([base, fromName, `${fromName}s`, `${base}s`]);

  for (const v of exercise.videos || []) {
    const fn = (v.filename || v.url?.split('/').pop() || '').toLowerCase();
    const m = fn.match(/(?:male|female)-(.+?)-(front|side)\.mp4/);
    if (m?.[1]) {
      set.add(m[1]);
      if (m[1].endsWith('s')) set.add(m[1].slice(0, -1));
      else set.add(`${m[1]}s`);
    }
  }
  return [...set].filter(Boolean);
}

function parseVideoMeta(url) {
  const clean = url.split('#')[0];
  const filename = clean.split('/').pop() || 'video.mp4';
  const lower = filename.toLowerCase();
  return {
    url: clean,
    filename,
    gender: lower.includes('female') ? 'female' : 'male',
    angle: lower.includes('side') ? 'side' : 'front',
    type: 'mp4',
  };
}

function buildVideosFromCapture(exercise, bodies, domSrcs) {
  const allUrls = new Set([
    ...bodies.keys(),
    ...domSrcs.map((s) => (s.startsWith('http') ? s : `${MEDIA}${s}`).split('#')[0]),
  ]);

  const videos = [];
  for (const url of allUrls) {
    if (!url.includes('.mp4')) continue;
    const meta = parseVideoMeta(url);
    const abs = localAbsolutePath(exercise.muscleWikiId, meta.filename);
    ensureDir(path.dirname(abs));

    const body = bodies.get(url);
    if (body && isValidMp4Buffer(body)) {
      fs.writeFileSync(abs, body);
      meta.localUrl = publicLocalUrl(exercise.muscleWikiId, meta.filename);
    } else if (isValidMp4File(abs)) {
      meta.localUrl = publicLocalUrl(exercise.muscleWikiId, meta.filename);
    } else if (fs.existsSync(abs)) {
      try {
        fs.unlinkSync(abs);
      } catch {
        /* ignore */
      }
    }
    videos.push(meta);
  }

  videos.sort((a, b) => {
    const order = (v) => (v.angle === 'front' ? 0 : v.angle === 'side' ? 1 : 2);
    return order(a) - order(b);
  });
  return videos;
}

async function getPlaywright() {
  if (!browser) {
    const { chromium } = require('playwright');
    browser = await chromium.launch({
      headless: process.env.MUSCLEWIKI_SYNC_HEADED !== '1',
    });
    context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      locale: 'en-US',
    });
    const warm = await context.newPage();
    await warm.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await warm.waitForTimeout(1500);
    await warm.close();
  }
  return { browser, context };
}

async function captureOnPage(page, url, waitMs, extraWaitMs) {
  const bodies = new Map();
  const onResponse = async (response) => {
    const u = response.url();
    if (!u.includes('media.musclewiki.com') || !u.includes('.mp4')) return;
    const st = response.status();
    if (st !== 200) return;
    if (bodies.has(u)) return;
    try {
      const body = await response.body();
      if (body.length > 10_000 && isValidMp4Buffer(body)) bodies.set(u, body);
    } catch {
      /* aborted */
    }
  };

  page.on('response', onResponse);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 75_000 });
    await page.waitForTimeout(waitMs);
    if (bodies.size === 0) {
      await page.waitForSelector('video', { timeout: 12_000 }).catch(() => {});
      await page.waitForTimeout(extraWaitMs);
    }
    const domSrcs = await page
      .$$eval('video[src], video source[src]', (els) =>
        els.map((e) => e.getAttribute('src')).filter(Boolean),
      )
      .catch(() => []);
    return { bodies, domSrcs };
  } finally {
    page.off('response', onResponse);
  }
}

async function syncExerciseVideosForSlug(exercise, slug, ctx, opts) {
  const page = await ctx.newPage();
  try {
    const { bodies, domSrcs } = await captureOnPage(
      page,
      `${SITE}/exercise/${slug}`,
      opts.waitMs ?? 4500,
      opts.extraWaitMs ?? 8000,
    );
    const videos = buildVideosFromCapture(exercise, bodies, domSrcs);
    return { slug, videos, captured: bodies.size };
  } finally {
    await page.close();
  }
}

async function syncExerciseVideos(exercise, opts = {}) {
  const { context: ctx } = await getPlaywright();
  const slugs = slugCandidates(exercise);
  let last = { slug: slugs[0], videos: [], captured: 0 };

  for (const slug of slugs) {
    const result = await syncExerciseVideosForSlug(exercise, slug, ctx, opts);
    last = result;
    if (result.videos.some((v) => v.localUrl)) return result;
    if (result.videos.length) last = result;
  }

  if (!last.videos.some((v) => v.localUrl)) {
    const mp4Urls = (exercise.videos || [])
      .map((v) => v.url?.split('#')[0])
      .filter((u) => u?.includes('.mp4'));
    if (mp4Urls.length) {
      const page = await ctx.newPage();
      try {
        const bodies = new Map();
        const onResponse = async (response) => {
          const u = response.url();
          if (!u.includes('.mp4') || response.status() !== 200) return;
          try {
            const body = await response.body();
            if (body.length > 10_000 && isValidMp4Buffer(body)) bodies.set(u.split('#')[0], body);
          } catch {
            /* ignore */
          }
        };
        page.on('response', onResponse);
        for (const url of mp4Urls) {
          await page.goto(url, { waitUntil: 'commit', timeout: 60_000 }).catch(() => {});
          await page.waitForTimeout(3000);
        }
        page.off('response', onResponse);
        const videos = buildVideosFromCapture(exercise, bodies, mp4Urls);
        if (videos.some((v) => v.localUrl)) {
          return { slug: last.slug, videos, captured: bodies.size };
        }
      } finally {
        await page.close();
      }
    }
  }

  return last;
}

async function closePlaywright() {
  if (browser) {
    await browser.close();
    browser = null;
    context = null;
  }
}

module.exports = {
  syncExerciseVideos,
  closePlaywright,
  slugify,
  slugCandidates,
};
