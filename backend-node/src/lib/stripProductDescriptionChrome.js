/**
 * Remove MFB site chrome (footer, nav blocks) accidentally scraped into product HTML.
 */

const BLOCK_TAGS = /<(?:footer|nav|aside)\b[\s\S]*?<\/(?:footer|nav|aside)>/gi;
const STRIP_TAGS = /<(?:link|style)\b[^>]*>/gi;

function cutAt(html, index) {
  if (index < 0) return html;
  return html.slice(0, index);
}

/**
 * @param {string|null|undefined} html
 * @returns {string}
 */
function stripProductDescriptionChrome(html) {
  if (!html?.trim()) return html || '';

  let out = html.replace(STRIP_TAGS, '').replace(BLOCK_TAGS, '');

  const mainFooter = out.match(/<\/main>\s*<\/div>\s*<footer\b/i);
  if (mainFooter && mainFooter.index >= out.length * 0.25) {
    out = cutAt(out, mainFooter.index);
  }

  const footerTag = out.search(/<footer\b/i);
  if (footerTag >= 0) out = cutAt(out, footerTag);

  const wdFooter = out.search(/\bwd-footer\b/i);
  if (wdFooter >= 0) out = cutAt(out, wdFooter);

  const elementorFooter = out.search(/\belementor-129543\b/i);
  if (elementorFooter >= 0 && elementorFooter > out.length * 0.25) {
    out = cutAt(out, elementorFooter);
  }

  const sellingIdx = out.search(/Selling premium Fitness\s*&\s*Health products/i);
  if (sellingIdx >= 0 && sellingIdx > out.length * 0.25) {
    out = cutAt(out, sellingIdx);
  }

  const usefulIdx = out.search(/USEFUL LINKS/i);
  if (usefulIdx >= 0 && usefulIdx > out.length * 0.25) {
    out = cutAt(out, usefulIdx);
  }

  const topCatIdx = out.search(/Top Categories[\s\S]{0,200}Healthy Crocieries/i);
  if (topCatIdx >= 0 && topCatIdx > out.length * 0.25) {
    out = cutAt(out, topCatIdx);
  }

  return out.replace(/\s+$/g, '').trim();
}

module.exports = { stripProductDescriptionChrome };
