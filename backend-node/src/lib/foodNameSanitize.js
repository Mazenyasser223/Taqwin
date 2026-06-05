/**
 * Clean USDA/FDC food labels for display and translation.
 * Strips brand prefix when brandOwner is known; preserves readable casing.
 */
function sanitizeFoodName(value, opts = {}) {
  if (value == null) return '';
  let name = String(value).trim();
  if (!name) return '';

  const brand = opts.brandOwner && String(opts.brandOwner).trim();
  if (brand) {
    const lower = name.toLowerCase();
    const brandLower = brand.toLowerCase();
    if (lower.startsWith(brandLower)) {
      name = name.slice(brand.length).replace(/^[\s,:-]+/, '').trim();
    }
  }

  return name.replace(/\s+/g, ' ').trim();
}

module.exports = { sanitizeFoodName };
