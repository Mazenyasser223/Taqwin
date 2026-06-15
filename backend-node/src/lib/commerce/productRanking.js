/**
 * Margin-aware product ranking within a category/slot.
 */
const { getLowStockThreshold } = require('../shopSettings');
const { getCommerceSettings } = require('./commerceSettings');

const SLOT_GOAL_AFFINITY = {
  protein: { muscle: 1, lose: 0.9, maintain: 0.7, endurance: 0.6 },
  creatine: { muscle: 1, lose: 0.85, maintain: 0.6, endurance: 0.5 },
  shaker: { muscle: 0.8, lose: 0.8, maintain: 0.8, endurance: 0.8 },
  pre_workout: { muscle: 0.7, lose: 0.6, maintain: 0.5, endurance: 1 },
  fbt: { muscle: 0.7, lose: 0.7, maintain: 0.7, endurance: 0.7 },
  diet_plan: { muscle: 0.8, lose: 0.8, maintain: 0.8, endurance: 0.8 },
};

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function marginScore(product) {
  const price = Number(product.price) || 0;
  const cost = Number(product.costPrice);
  if (price <= 0) return 0.3;
  if (!Number.isFinite(cost) || cost <= 0) return 0.35;
  return clamp01((price - cost) / price);
}

function stockScore(product, lowStockThreshold) {
  const stock = Number(product.stock) || 0;
  if (stock <= 0) return 0;
  if (stock < lowStockThreshold) return 0.5;
  if (stock < lowStockThreshold * 3) return 0.75;
  return 1;
}

function popularityScore(product, maxSales, maxWishlist = 0) {
  const sales = Number(product.salesCount) || 0;
  const wishlist = Number(product.wishlistCount) || 0;
  const salesPart = maxSales <= 0 ? (sales > 0 ? 0.5 : 0.2) : clamp01(sales / maxSales);
  const wishPart =
    maxWishlist <= 0 ? (wishlist > 0 ? 0.4 : 0.15) : clamp01(wishlist / maxWishlist);
  return clamp01(salesPart * 0.75 + wishPart * 0.25);
}

function ratingScore(product) {
  const rating = Number(product.avgRating);
  if (!Number.isFinite(rating) || rating <= 0) {
    return product.isFeatured ? 0.65 : 0.4;
  }
  return clamp01(rating / 5);
}

function nutritionMatchScore(slot, ctx) {
  if (slot === 'protein' && ctx.proteinTargetG >= 150) return 1;
  if (slot === 'protein' && ctx.proteinTargetG >= 120) return 0.85;
  if (slot === 'creatine' && (ctx.goalKey === 'muscle' || ctx.goalKey === 'lose')) return 0.9;
  if (slot === 'diet_plan') return 0.95;
  return 0.6;
}

/**
 * @param {object} product
 * @param {{ slot: string, goalKey: string, proteinTargetG?: number }} ctx
 * @param {{ maxSales: number, lowStockThreshold: number, weights: object }} stats
 */
function scoreProduct(product, ctx, stats) {
  const weights = stats.weights || getCommerceSettings().rankingWeights;
  const slot = ctx.slot || 'protein';
  const goalKey = ctx.goalKey || 'muscle';
  const affinity = SLOT_GOAL_AFFINITY[slot]?.[goalKey] ?? 0.6;

  const goalMatch = affinity;
  const nutritionMatch = nutritionMatchScore(slot, ctx);
  const popularity = popularityScore(product, stats.maxSales, stats.maxWishlist);
  const rating = ratingScore(product);
  const stock = stockScore(product, stats.lowStockThreshold);
  const margin = marginScore(product);

  const total =
    weights.goalMatch * goalMatch +
    weights.nutritionMatch * nutritionMatch +
    weights.popularity * popularity +
    weights.rating * rating +
    weights.stock * stock +
    weights.margin * margin;

  return {
    total,
    breakdown: { goalMatch, nutritionMatch, popularity, rating, stock, margin },
  };
}

/**
 * Rank in-stock products; out-of-stock are excluded entirely.
 * @param {object[]} products
 */
function rankProducts(products, ctx, stats = {}) {
  const lowStockThreshold = stats.lowStockThreshold ?? getLowStockThreshold();
  const maxSales = Math.max(1, ...products.map((p) => Number(p.salesCount) || 0));
  const maxWishlist = Math.max(1, ...products.map((p) => Number(p.wishlistCount) || 0));
  const weights = stats.weights || getCommerceSettings().rankingWeights;

  const inStock = products.filter((p) => p.isActive !== false && (Number(p.stock) || 0) > 0);
  const scored = inStock.map((product) => ({
    product,
    score: scoreProduct(product, ctx, { maxSales, maxWishlist, lowStockThreshold, weights }).total,
  }));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (Boolean(b.product.isFeatured) !== Boolean(a.product.isFeatured)) {
      return b.product.isFeatured ? 1 : -1;
    }
    return (a.product.sortOrder ?? 0) - (b.product.sortOrder ?? 0);
  });
  return scored;
}

module.exports = { scoreProduct, rankProducts, stockScore };
