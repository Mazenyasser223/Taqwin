/**
 * Commerce settings — bundle discounts, ranking weights (file + env overrides).
 */
const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, '../../data/shop-settings.json');

const DEFAULTS = {
  bundleDiscountPercent: Number(process.env.SHOP_AI_BUNDLE_DISCOUNT_PERCENT) || 10,
  bundleDiscountMinItems: Number(process.env.SHOP_AI_BUNDLE_MIN_ITEMS) || 3,
  rankingWeights: {
    goalMatch: 0.4,
    nutritionMatch: 0.2,
    popularity: 0.15,
    rating: 0.1,
    stock: 0.05,
    margin: 0.1,
  },
};

function readFileSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    return typeof raw === 'object' && raw ? raw : {};
  } catch {
    return {};
  }
}

function getCommerceSettings() {
  const file = readFileSettings();
  const commerce = file.commerce && typeof file.commerce === 'object' ? file.commerce : {};
  return {
    bundleDiscountPercent:
      Number.isFinite(Number(commerce.bundleDiscountPercent)) && commerce.bundleDiscountPercent > 0
        ? Number(commerce.bundleDiscountPercent)
        : DEFAULTS.bundleDiscountPercent,
    bundleDiscountMinItems:
      Number.isFinite(Number(commerce.bundleDiscountMinItems)) && commerce.bundleDiscountMinItems >= 2
        ? Math.floor(Number(commerce.bundleDiscountMinItems))
        : DEFAULTS.bundleDiscountMinItems,
    rankingWeights: {
      ...DEFAULTS.rankingWeights,
      ...(commerce.rankingWeights && typeof commerce.rankingWeights === 'object'
        ? commerce.rankingWeights
        : {}),
    },
  };
}

function bundleTitleForGoal(goalKey, locale = 'ar') {
  const titles = {
    muscle: { en: 'Muscle Gain Starter Pack', ar: 'باقة بناء العضلات' },
    lose: { en: 'Fat Loss Support Pack', ar: 'باقة دعم خسارة الدهون' },
    endurance: { en: 'Endurance Performance Pack', ar: 'باقة الأداء والتحمل' },
    maintain: { en: 'Wellness Essentials Pack', ar: 'باقة العافية الأساسية' },
  };
  const row = titles[goalKey] || titles.muscle;
  return locale === 'en' ? row.en : row.ar;
}

module.exports = { getCommerceSettings, bundleTitleForGoal, DEFAULTS };
