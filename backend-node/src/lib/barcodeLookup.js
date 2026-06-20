/**
 * Barcode product lookup — Open Food Facts only (no catalog matching).
 */
const { logger } = require('./logger');
const { redisGetJson, redisSetJson } = require('./redis');

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeBarcodeInput(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;

  const gs1 = s.match(/(?:^|\/)01[/]?(\d{14})(?:\D|$)/) || s.match(/01(\d{14})/);
  if (gs1) {
    const gtin = gs1[1];
    if (gtin.length === 14) return gtin.startsWith('0') ? gtin.slice(1, 14) : gtin.slice(0, 13);
    return gtin.slice(0, 13);
  }

  const digits = s.replace(/\D/g, '');
  if (digits.length >= 8 && digits.length <= 14) {
    if (digits.length === 14) return digits.slice(0, 13);
    if (digits.length === 12) return digits;
    if (digits.length === 13) return digits;
    return digits.padStart(13, '0');
  }

  return null;
}

function num(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function kcalFromNutriments(n) {
  if (!n || typeof n !== 'object') return 0;
  const kcal = num(n['energy-kcal_100g']);
  if (kcal > 0) return Math.round(kcal);
  const kj = num(n.energy_100g);
  if (kj > 0) return Math.round(kj / 4.184);
  return 0;
}

function parseServingGrams(product) {
  const qty = num(product.product_quantity);
  if (qty > 0 && qty <= 5000) return Math.round(qty);

  const servingSize = String(product.serving_size || '').trim();
  const m = servingSize.match(/(\d+(?:\.\d+)?)\s*g/i);
  if (m) return Math.min(5000, Math.max(1, Math.round(Number(m[1]))));

  const servingQty = num(product.serving_quantity);
  if (servingQty > 0 && servingQty <= 5000) return Math.round(servingQty);

  return 100;
}

function buildDisplayName(product) {
  const name = String(product.product_name || product.product_name_en || '').trim();
  const brand = String(product.brands || product.brand_owner || '').trim();
  if (name && brand && !name.toLowerCase().includes(brand.toLowerCase())) {
    return `${brand} ${name}`;
  }
  return name || brand || 'Packaged food';
}

async function fetchOpenFoodFacts(barcode) {
  const url = `${OFF_BASE}/${encodeURIComponent(barcode)}.json`;
  const timeoutMs = Number(process.env.BARCODE_LOOKUP_TIMEOUT_MS || 12000);
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Taqwin/1.0 (nutrition app)' },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    logger.warn({ status: res.status, barcode }, 'Open Food Facts request failed');
    return null;
  }

  const payload = await res.json();
  if (!payload || payload.status !== 1 || !payload.product) return null;
  return payload.product;
}

async function lookupBarcodeProduct(rawCode) {
  const barcode = normalizeBarcodeInput(rawCode);
  if (!barcode) return { found: false, error: 'INVALID_BARCODE' };

  const cacheKey = `barcode:off:${barcode}`;
  const cached = await redisGetJson(cacheKey);
  if (cached && typeof cached === 'object' && cached.found) {
    return cached;
  }

  const offProduct = await fetchOpenFoodFacts(barcode);
  if (!offProduct) {
    return { found: false, error: 'BARCODE_NOT_FOUND', barcode };
  }

  const nutriments = offProduct.nutriments || {};
  const macrosPer100 = {
    calories: kcalFromNutriments(nutriments),
    protein: Math.round(num(nutriments.proteins_100g) * 10) / 10,
    carbs: Math.round(num(nutriments.carbohydrates_100g) * 10) / 10,
    fat: Math.round(num(nutriments.fat_100g) * 10) / 10,
  };

  if (macrosPer100.calories <= 0 && macrosPer100.protein <= 0 && macrosPer100.carbs <= 0) {
    macrosPer100.calories = Math.max(
      1,
      Math.round(macrosPer100.protein * 4 + macrosPer100.carbs * 4 + macrosPer100.fat * 9)
    );
  }

  const name = buildDisplayName(offProduct);
  const gramsDefault = parseServingGrams(offProduct);
  const imageUrl =
    offProduct.image_front_small_url ||
    offProduct.image_url ||
    offProduct.image_front_url ||
    null;

  const product = {
    found: true,
    barcode,
    name,
    brand: String(offProduct.brands || '').trim() || null,
    imageUrl,
    gramsDefault,
    macrosPer100,
    kitchenFood: true,
    source: 'open_food_facts',
  };

  await redisSetJson(cacheKey, product, CACHE_TTL_MS).catch(() => null);
  return product;
}

module.exports = {
  normalizeBarcodeInput,
  lookupBarcodeProduct,
};
