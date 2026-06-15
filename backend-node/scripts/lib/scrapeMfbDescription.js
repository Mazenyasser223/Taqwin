/**
 * Scrape full product description HTML from MFB product pages.
 */

function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8211;/g, '–')
    .replace(/&nbsp;/g, ' ');
}

/** Extract description tab HTML from product page. */
function extractDescriptionHtml(pageHtml) {
  if (!pageHtml) return null;

  const patterns = [
    /id="tab-description"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<div[^>]+class="woocommerce-Tabs-panel/i,
    /woocommerce-Tabs-panel--description[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<div[^>]+class="woocommerce-Tabs-panel/i,
    /class="woocommerce-product-details__short-description"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const re of patterns) {
    const m = pageHtml.match(re);
    if (m && m[1]) {
      const inner = m[1].trim();
      if (inner.length > 80) return cleanScrapedHtml(inner);
    }
  }

  const khIdx = pageHtml.search(/Key Highlights/i);
  const htuIdx = pageHtml.search(/How to Use/i);
  const startIdx = Math.min(
    khIdx >= 0 ? khIdx - 800 : Infinity,
    htuIdx >= 0 ? htuIdx - 800 : Infinity
  );
  if (startIdx < Infinity && startIdx >= 0) {
    const chunk = pageHtml.slice(startIdx, startIdx + 12000);
    const endMatch = chunk.search(/<\/div>\s*<\/div>\s*<div[^>]+class="woocommerce-Tabs-panel/i);
    const slice = endMatch > 500 ? chunk.slice(0, endMatch) : chunk;
    const wrapped = `<div>${slice}</div>`;
    if (/Key Highlights|How to Use/i.test(wrapped)) return cleanScrapedHtml(wrapped);
  }

  const widgetMatch = pageHtml.match(
    /wd_single_product_content[\s\S]{0,400}?elementor-widget-container">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<div class="elementor-element/i
  );
  if (widgetMatch && widgetMatch[1] && widgetMatch[1].trim().length > 40) {
    return cleanScrapedHtml(`<div>${widgetMatch[1].trim()}</div>`);
  }

  const summaryMatch = pageHtml.match(
    /class="woocommerce-product-details__short-description"[^>]*>([\s\S]*?)<\/div>/i
  );
  if (summaryMatch && summaryMatch[1].trim().length > 20) {
    return cleanScrapedHtml(`<div>${summaryMatch[1].trim()}</div>`);
  }

  return null;
}

const { stripProductDescriptionChrome } = require('../../src/lib/stripProductDescriptionChrome');

function cleanScrapedHtml(html) {
  return decodeEntities(
    stripProductDescriptionChrome(html)
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/data-path-to-node="[^"]*"/gi, '')
      .replace(/data-index-in-node="[^"]*"/gi, '')
      .replace(/class="citation-\d+"/gi, '')
      .replace(/<span class="citation-end-\d+"><\/span>/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .trim()
  ).slice(0, 50000);
}

function normalizeSlug(slug) {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

async function fetchFromStoreApi(slug, baseUrl = 'https://myfitnessbag.com') {
  const pathSlug = encodeURI(normalizeSlug(slug)).replace(/%25/g, '%');
  const url = `${baseUrl}/wp-json/wc/store/products?slug=${encodeURIComponent(pathSlug)}`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const json = await res.json();
    const p = json?.[0];
    const raw = p?.description || p?.short_description;
    if (raw && String(raw).trim().length > 80) {
      const html = cleanScrapedHtml(String(raw));
      if (html.length > 80) return html;
    }
  } catch {
    /* fall through to page scrape */
  }
  return null;
}

async function fetchProductDescription(slug, { baseUrl = 'https://myfitnessbag.com' } = {}) {
  const fromApi = await fetchFromStoreApi(slug, baseUrl);
  if (fromApi) {
    return {
      html: fromApi,
      hasKeyHighlights: /key\s*(highlights|benefits)/i.test(fromApi),
      hasHowToUse: /how\s+to\s+use/i.test(fromApi),
      source: 'api',
    };
  }

  const pathSlug = encodeURI(normalizeSlug(slug)).replace(/%25/g, '%');
  const url = `${baseUrl}/product/${pathSlug}/`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'TaqwinCatalogBot/1.0 (+https://taqwin.app)' },
    redirect: 'follow',
  });
  if (!res.ok) return { error: `HTTP ${res.status}`, html: null };
  const pageHtml = await res.text();
  const html = extractDescriptionHtml(pageHtml);
  if (!html) return { error: 'no description block', html: null };
  return {
    html,
    hasKeyHighlights: /key\s*(highlights|benefits)/i.test(html),
    hasHowToUse: /how\s+to\s+use/i.test(html),
    source: 'scrape',
  };
}

module.exports = {
  extractDescriptionHtml,
  fetchProductDescription,
  cleanScrapedHtml,
};
