const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, '../../data/shop-settings.json');

const DEFAULT_LOW_STOCK_THRESHOLD = Number(process.env.SHOP_LOW_STOCK_THRESHOLD) || 5;

function readFileSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    return typeof raw === 'object' && raw ? raw : {};
  } catch {
    return {};
  }
}

function getLowStockThreshold() {
  const fromFile = readFileSettings().lowStockThreshold;
  if (Number.isFinite(fromFile) && fromFile > 0) return Math.floor(fromFile);
  return DEFAULT_LOW_STOCK_THRESHOLD;
}

function getShopSettings() {
  return { lowStockThreshold: getLowStockThreshold() };
}

function updateShopSettings(patch) {
  const current = readFileSettings();
  const next = { ...current };
  if (patch.lowStockThreshold !== undefined) {
    const n = Number(patch.lowStockThreshold);
    if (!Number.isFinite(n) || n < 1 || n > 500) {
      const err = new Error('lowStockThreshold must be between 1 and 500');
      err.status = 400;
      throw err;
    }
    next.lowStockThreshold = Math.floor(n);
  }
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2), 'utf8');
  return getShopSettings();
}

module.exports = { getLowStockThreshold, getShopSettings, updateShopSettings };
