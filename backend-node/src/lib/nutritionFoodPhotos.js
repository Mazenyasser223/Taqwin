/**
 * Webteb IDs that have synced photos in frontend/public/nutrition/foods/manifest.json
 */
const fs = require('fs');
const path = require('path');

const MANIFEST_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'frontend',
  'public',
  'nutrition',
  'foods',
  'manifest.json'
);

let cachedIds = null;
let cachedMtimeMs = 0;

function loadPhotoWebtebIds() {
  try {
    if (!fs.existsSync(MANIFEST_PATH)) return [];
    const stat = fs.statSync(MANIFEST_PATH);
    if (cachedIds && stat.mtimeMs === cachedMtimeMs) return cachedIds;
    const raw = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    cachedIds = Object.keys(raw)
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n) && n > 0);
    cachedMtimeMs = stat.mtimeMs;
    return cachedIds;
  } catch {
    cachedIds = [];
    return cachedIds;
  }
}

function getPhotoWebtebIdSet() {
  return new Set(loadPhotoWebtebIds());
}

function usesDefaultNameSort(filterQuery = {}) {
  if (filterQuery.sort === 'proteinDensity') return false;
  if (filterQuery.sort && filterQuery.sort !== 'name') return false;
  if (filterQuery.sort2 && filterQuery.sort2 !== 'name') return false;
  return true;
}

module.exports = {
  loadPhotoWebtebIds,
  getPhotoWebtebIdSet,
  usesDefaultNameSort,
};
