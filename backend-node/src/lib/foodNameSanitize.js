/**
 * Strip brand owners, company names, and non-food marketing fragments from USDA labels.
 * Keeps the core food description (e.g. "Yogurt, plain, whole milk").
 */

const COMPANY_MARKERS = /\b(inc\.?|llc|ltd\.?|corp\.?|corporation|company|co\.|®|™)\b/i;

/** Comma-separated fragments that are not the food name itself. */
const DROP_PART_PHRASES = new Set([
  'atlantic',
  'pacific',
  'farm raised',
  'farm-raised',
  'farmed',
  'wild caught',
  'wild-caught',
  'cage free',
  'cage-free',
  'free range',
  'free-range',
  'grain fed',
  'grain-fed',
  'pasture raised',
  'pasture-raised',
  'boneless',
  'skinless',
  'boneless skinless',
  'with bone',
  'without salt',
  'with salt',
  'nfs',
  'not further specified',
  'all samples',
  'imported',
  'domestic',
]);

/** Common packaged-food brand names (lowercase). */
const KNOWN_BRAND_PHRASES = new Set([
  'kraft',
  'kellogg',
  "kellogg's",
  'general mills',
  'nestle',
  'pepsi',
  'coca-cola',
  'coca cola',
  'heinz',
  'campbell',
  "campbell's",
  'tyson',
  'hormel',
  'conagra',
  'unilever',
  'mars',
  'mondelez',
  'danone',
  'dannon',
  'yoplait',
  'chobani',
  'fage',
  'land o lakes',
  "land o'lakes",
  'sargento',
  'philadelphia',
  'breakstones',
  'breakstone',
  'oscar mayer',
  'smithfield',
  'perdue',
  'foster farms',
  'great value',
  'kirkland',
  'trader joe',
  "trader joe's",
  'whole foods',
  'aldi',
  'lidl',
  'walmart',
  'target',
]);

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizePart(part) {
  return String(part || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function splitNameParts(name) {
  return String(name || '')
    .split(/[,،]/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function stripBrandPrefix(name, brandOwner) {
  if (!name || !brandOwner) return name || '';
  const bo = String(brandOwner).trim();
  if (!bo) return name;
  const re = new RegExp(`^${escapeRegex(bo)}\\s*[,،]?\\s*`, 'i');
  return name.replace(re, '').trim();
}

function partMatchesBrand(part, brandOwner) {
  if (!brandOwner) return false;
  const p = normalizePart(part);
  const b = normalizePart(brandOwner);
  if (!p || !b) return false;
  if (p === b) return true;
  if (p.includes(b) || b.includes(p)) return true;
  return false;
}

function shouldDropPart(part, { brandOwner } = {}) {
  const n = normalizePart(part);
  if (!n) return true;
  if (partMatchesBrand(part, brandOwner)) return true;
  if (DROP_PART_PHRASES.has(n)) return true;
  if (KNOWN_BRAND_PHRASES.has(n)) return true;
  if (COMPANY_MARKERS.test(part)) return true;
  return false;
}

/**
 * @param {string} name
 * @param {{ brandOwner?: string | null, maxParts?: number }} [options]
 * @returns {string}
 */
function sanitizeFoodName(name, options = {}) {
  const { brandOwner = null, maxParts = 4 } = options;
  if (!name || typeof name !== 'string') return '';

  let cleaned = stripBrandPrefix(name, brandOwner);
  cleaned = stripBrandPrefix(cleaned, brandOwner);

  const parts = splitNameParts(cleaned);
  if (!parts.length) return name.trim();

  const kept = parts.filter((p) => !shouldDropPart(p, { brandOwner }));
  const limited = (kept.length ? kept : [parts[0]]).slice(0, maxParts);
  return limited.join(', ').trim();
}

module.exports = {
  sanitizeFoodName,
  stripBrandPrefix,
  splitNameParts,
};
