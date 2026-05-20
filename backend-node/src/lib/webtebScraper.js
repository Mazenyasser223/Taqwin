/**
 * Fetch and parse WebTeb nutrition facts pages.
 */
const cheerio = require('cheerio');
const { parseWebtebFoodPage } = require('./webtebParsePage');
const { taqwinIdForSlug, buildCategorySeedRows } = require('./webtebCategories');

const BASE = 'https://www.webteb.com';
const INDEX_URL = `${BASE}/nutritionfacts`;
const NUTRITION_SITEMAP_URL = `${BASE}/sitemaps/webteb/nutrition-facts-1.xml`;
const FOOD_LINK_RE = /\/nutritionfacts\/([^/]+)\/([^/"#]+)_(\d+)\/?$/i;
const CATEGORY_LINK_RE = /^\/nutritionfacts\/([^/]+)\/?$/i;

const DEFAULT_HEADERS = {
  'User-Agent': 'TaqwinNutritionImporter/1.0 (+https://taqwin.app; licensed data import)',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'ar,en;q=0.8',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url, retries = 3) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: DEFAULT_HEADERS, redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      await sleep(1500 * (i + 1));
    }
  }
  throw lastErr;
}

function absolutize(href) {
  if (!href) return null;
  if (href.startsWith('http')) return href.split('#')[0];
  return `${BASE}${href.startsWith('/') ? '' : '/'}${href}`.split('#')[0];
}

function extractCategories(html) {
  const $ = cheerio.load(html);
  const found = [];
  $('a[href*="/nutritionfacts/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const path = href.replace(BASE, '');
    const m = path.match(CATEGORY_LINK_RE);
    if (!m) return;
    const slug = m[1];
    if (slug === 'nutritionfacts') return;
    const nameAr = $(el).text().replace(/\s+/g, ' ').trim();
    if (!nameAr) return;
    found.push({ slug, nameAr, url: absolutize(href) });
  });
  return buildCategorySeedRows(found);
}

function parseFoodUrl(url) {
  const abs = absolutize(url);
  if (!abs) return null;
  const m = abs.match(FOOD_LINK_RE);
  if (!m) return null;
  return {
    url: abs,
    categorySlug: m[1],
    slug: m[2],
    webtebId: Number(m[3]),
  };
}

/** All food detail URLs from WebTeb nutrition sitemap (~2100 items). */
async function fetchSitemapFoodLinks() {
  const xml = await fetchHtml(NUTRITION_SITEMAP_URL);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => m[1]);
  const links = [];
  const seen = new Set();
  for (const loc of locs) {
    const link = parseFoodUrl(loc);
    if (!link || !Number.isFinite(link.webtebId) || seen.has(link.webtebId)) continue;
    seen.add(link.webtebId);
    links.push(link);
  }
  return links;
}

function extractFoodLinks(html, categorySlug) {
  const $ = cheerio.load(html);
  const links = new Map();
  $('a[href]').each((_, el) => {
    const href = absolutize($(el).attr('href'));
    if (!href) return;
    const m = href.match(FOOD_LINK_RE);
    if (!m) return;
    if (categorySlug && m[1] !== categorySlug) return;
    const webtebId = Number(m[3]);
    if (!Number.isFinite(webtebId)) return;
    links.set(webtebId, {
      url: href,
      categorySlug: m[1],
      slug: m[2],
      webtebId,
    });
  });
  return [...links.values()];
}

async function fetchCategoryIndex() {
  const html = await fetchHtml(INDEX_URL);
  return extractCategories(html);
}

async function fetchCategoryFoodLinks(categorySlug) {
  const url = `${BASE}/nutritionfacts/${categorySlug}`;
  const html = await fetchHtml(url);
  return extractFoodLinks(html, categorySlug);
}

async function fetchFoodPage(url) {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const parsed = parseWebtebFoodPage($, url);
  if (!parsed.webtebId) {
    const m = url.match(/_(\d+)\/?$/);
    if (m) parsed.webtebId = Number(m[1]);
  }
  return parsed;
}

module.exports = {
  BASE,
  INDEX_URL,
  NUTRITION_SITEMAP_URL,
  fetchHtml,
  fetchCategoryIndex,
  fetchCategoryFoodLinks,
  fetchSitemapFoodLinks,
  fetchFoodPage,
  extractFoodLinks,
  parseFoodUrl,
  taqwinIdForSlug,
  sleep,
};
