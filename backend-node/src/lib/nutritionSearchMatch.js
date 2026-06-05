/**
 * Keep only USDA rows that match the user's search text (not the whole browse category).
 */
const { hasArabicScript, normalizeArabic } = require('./nutritionSearchQuery');

function normalizeHay(text) {
  return String(text)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

function tokenMatches(hay, token) {
  if (!token) return true;
  if (hay.includes(token)) return true;
  if (token.length < 3) return false;
  const words = hay.split(/\s+/).filter((w) => w.length >= 2);
  for (const w of words) {
    if (Math.abs(w.length - token.length) > 2) continue;
    let dist = 0;
    const minLen = Math.min(w.length, token.length);
    for (let i = 0; i < minLen; i++) {
      if (w[i] !== token[i]) dist++;
      if (dist > 1) break;
    }
    dist += Math.abs(w.length - token.length);
    if (dist <= 1) return true;
  }
  return false;
}

function rawTokens(rawQ) {
  const trimmed = (rawQ || '').trim();
  if (!trimmed) return [];
  const norm = hasArabicScript(trimmed) ? normalizeArabic(trimmed) : normalizeHay(trimmed);
  return norm.split(/\s+/).filter((t) => t.length > 0);
}

function resolvedTokens(resolvedQ) {
  return normalizeHay(resolvedQ || '')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function foodMatchesUserSearch(food, rawQ, resolvedQ) {
  const rToks = rawTokens(rawQ);
  if (rToks.length === 0) return true;

  const hay = normalizeHay(`${food.name || ''} ${food.foodCategory || ''}`);
  const enToks = resolvedTokens(resolvedQ);

  return rToks.every((rt) => {
    if (tokenMatches(hay, rt)) return true;
    return enToks.some((et) => tokenMatches(hay, et));
  });
}

function filterFoodsByUserSearch(foods, rawQ, resolvedQ) {
  const trimmed = (rawQ || '').trim();
  if (!trimmed) return foods;
  return foods.filter((f) => foodMatchesUserSearch(f, trimmed, resolvedQ));
}

module.exports = {
  filterFoodsByUserSearch,
  foodMatchesUserSearch,
};
