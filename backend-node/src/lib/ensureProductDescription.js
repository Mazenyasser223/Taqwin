/**
 * Ensure every product description includes Description, Key Highlights, and How to Use.
 * Appends Taqwin fallback blocks when MFB import is missing sections.
 */

const { stripProductDescriptionChrome } = require('./stripProductDescriptionChrome');

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hasPattern(text, pattern) {
  return pattern.test(String(text || ''));
}

function findKeywordIndex(html, keyword) {
  const m = String(html || '').match(keyword);
  return m && m.index != null ? m.index : -1;
}

function findSectionStart(html, keywordIndex) {
  if (keywordIndex <= 0) return 0;
  const before = html.slice(0, keywordIndex);
  const candidates = [
    before.lastIndexOf('<h1'),
    before.lastIndexOf('<h2'),
    before.lastIndexOf('<h3'),
    before.lastIndexOf('<h4'),
    before.lastIndexOf('<p'),
    before.lastIndexOf('<div'),
  ].filter((i) => i >= 0);
  return candidates.length ? Math.max(...candidates) : keywordIndex;
}

/** @returns {{ description: string, keyHighlights: string, howToUse: string }} */
function parseProductDescription(raw) {
  const empty = { description: '', keyHighlights: '', howToUse: '' };
  if (!raw?.trim()) return empty;

  const html = raw.trim();
  const khIdx = findKeywordIndex(html, /key\s*highlights/i);
  const htuIdx = findKeywordIndex(html, /how\s+to\s+use/i);

  if (khIdx >= 0 && htuIdx > khIdx) {
    const khStart = findSectionStart(html, khIdx);
    const htuStart = findSectionStart(html, htuIdx);
    return {
      description: html.slice(0, khStart).trim(),
      keyHighlights: html.slice(khStart, htuStart).trim(),
      howToUse: html.slice(htuStart).trim(),
    };
  }

  if (khIdx >= 0) {
    const khStart = findSectionStart(html, khIdx);
    return {
      description: html.slice(0, khStart).trim(),
      keyHighlights: html.slice(khStart).trim(),
      howToUse: '',
    };
  }

  if (htuIdx >= 0) {
    const htuStart = findSectionStart(html, htuIdx);
    return {
      description: html.slice(0, htuStart).trim(),
      keyHighlights: '',
      howToUse: html.slice(htuStart).trim(),
    };
  }

  return { description: html, keyHighlights: '', howToUse: '' };
}

function buildFallbackDescription(product) {
  const name = escapeHtml(product.name);
  const brand = escapeHtml(product.brand);
  const category = escapeHtml(product.category?.nameEn || '—');
  return `<p>${name} from ${brand}. Listed in ${category} on Taqwin Shop with secure checkout and delivery across Egypt.</p>`;
}

function buildFallbackKeyHighlights(product) {
  const brand = escapeHtml(product.brand);
  const category = escapeHtml(product.category?.nameEn || '—');
  const currency = product.currency || 'EGP';
  const price =
    typeof product.price === 'number' ? `${product.price.toFixed(0)} ${currency}` : `— ${currency}`;
  const stockLine =
    (product.stock ?? 0) > 0
      ? 'Currently in stock and ready to ship.'
      : 'Currently out of stock — check back soon or browse similar items.';
  return `<h3><b>Key Highlights:</b></h3><ul>
<li><p><b>Brand:</b> ${brand}</p></li>
<li><p><b>Category:</b> ${category}</p></li>
<li><p><b>Price:</b> ${escapeHtml(price)}</p></li>
<li><p>${escapeHtml(stockLine)}</p></li>
</ul>`;
}

function buildFallbackHowToUse() {
  return `<h3><b>How to Use:</b></h3><ul>
<li><p>Read the label and package instructions before use.</p></li>
<li><p>Use only as directed on the product label or by a qualified professional.</p></li>
<li><p>Store in a cool, dry place away from direct sunlight and moisture.</p></li>
</ul>`;
}

function productHasAllSections(description) {
  const d = String(description || '');
  if (!d.trim()) return false;
  return (
    hasPattern(d, /key\s*highlights/i) &&
    hasPattern(d, /how\s+to\s+use/i) &&
    d.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length >= 40
  );
}

/**
 * @param {{ name: string, brand: string, price?: number, currency?: string, stock?: number, description?: string|null, category?: { nameEn?: string }|null }} product
 * @returns {string}
 */
function ensureProductDescription(product) {
  const raw = stripProductDescriptionChrome(product.description || '');
  const parsed = parseProductDescription(raw);

  let description = parsed.description.trim();
  let keyHighlights = parsed.keyHighlights.trim();
  let howToUse = parsed.howToUse.trim();

  if (!description) {
    description = raw.trim() || buildFallbackDescription(product);
  }

  if (!keyHighlights) {
    keyHighlights = buildFallbackKeyHighlights(product);
  }

  if (!howToUse) {
    howToUse = buildFallbackHowToUse();
  }

  return `${description}\n${keyHighlights}\n${howToUse}`.trim();
}

module.exports = {
  ensureProductDescription,
  productHasAllSections,
  parseProductDescription,
};
