/**

 * Rule-based + ranked product bundle recommendations from athlete profile + diet plan.

 */

const { prisma } = require('../../db');

const { normalizeProduct } = require('../shopProduct');

const { extractOnboardingForCoach } = require('../onboardingForCoach');

const { estimateDailyTargets } = require('../plans/targets');

const { getLowStockThreshold } = require('../shopSettings');

const { rankProducts } = require('./productRanking');

const { buildReasonCopy } = require('./commerceReasons');

const { getFrequentlyBoughtTogether, PRODUCT_SELECT } = require('./frequentlyBoughtTogether');

const { getCommerceSettings, bundleTitleForGoal } = require('./commerceSettings');

const { newCommerceSessionId } = require('./recommendationEvents');

const { assignAbVariant } = require('./abTesting');



const RECENT_ORDER_DAYS = 90;



function arr(value) {

  if (Array.isArray(value)) return value.map(String);

  if (value == null || value === '') return [];

  return [String(value)];

}



function goalKey(primaryGoal) {

  const g = String(primaryGoal || '').toLowerCase();

  if (g.includes('lose') || g.includes('fat') || g.includes('weight')) return 'lose';

  if (g.includes('endurance') || g.includes('condition')) return 'endurance';

  if (g.includes('healthy') || g.includes('wellness')) return 'maintain';

  return 'muscle';

}



function isVeganOrPlantOnly(onboardingRaw, flat) {

  const diet = [...arr(flat?.diet), ...arr(onboardingRaw?.dietType)];

  const joined = diet.join(' ').toLowerCase();

  if (joined.includes('vegan') || joined.includes('plant')) return true;

  const excluded = [...arr(flat?.foodsExcluded), ...arr(onboardingRaw?.foodsExcluded)];

  return excluded.some((e) => /dairy|milk|whey|lactose/i.test(e));

}



function supplementsTextMentions(text, patterns) {

  const hay = String(text || '').toLowerCase();

  if (!hay.trim()) return false;

  return patterns.some((p) => p.test(hay));

}



function normalizeSupplementsBudget(raw) {

  if (Array.isArray(raw)) {

    const names = raw

      .map((p) => {

        if (!p || typeof p !== 'object') return '';

        return String(p.name || p.nameEn || p.displayName || '').trim();

      })

      .filter(Boolean);

    const productIds = raw

      .map((p) => (p && typeof p === 'object' ? p.id : null))

      .filter((id) => typeof id === 'string' && id);

    return { text: names.join(', '), productIds };

  }

  return { text: String(raw || ''), productIds: [] };

}



async function getCategoryDescendantIds(rootId) {

  const all = await prisma.shopCategory.findMany({ select: { id: true, parentId: true } });

  const ids = [rootId];

  const queue = [rootId];

  while (queue.length) {

    const pid = queue.shift();

    for (const c of all.filter((x) => x.parentId === pid)) {

      ids.push(c.id);

      queue.push(c.id);

    }

  }

  return ids;

}



async function pickProductInCategory(categorySlug, excludeIds, ctx) {

  const cat = await prisma.shopCategory.findFirst({ where: { slug: categorySlug } });

  if (!cat) return null;



  const categoryIds = await getCategoryDescendantIds(cat.id);

  const rows = await prisma.product.findMany({

    where: {

      isActive: true,

      stock: { gt: 0 },

      categoryId: { in: categoryIds },

      ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),

    },

    take: 20,

    select: PRODUCT_SELECT,

  });



  const ranked = rankProducts(rows, ctx, { lowStockThreshold: getLowStockThreshold() });

  return ranked[0]?.product ? normalizeProduct(ranked[0].product) : null;

}



/** Try category slugs in order until a product is found. */
async function pickProductInCategories(categorySlugs, excludeIds, ctx) {
  for (const slug of categorySlugs) {
    const product = await pickProductInCategory(slug, excludeIds, ctx);
    if (product) return product;
  }
  return null;
}



async function recentOrderedProductIds(userId) {

  const since = new Date(Date.now() - RECENT_ORDER_DAYS * 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({

    where: {

      userId,

      createdAt: { gte: since },

      status: { notIn: ['cancelled'] },

    },

    select: { items: { select: { productId: true } } },

    take: 20,

  });

  const ids = new Set();

  for (const o of orders) {

    for (const item of o.items || []) {

      if (item.productId) ids.add(item.productId);

    }

  }

  return [...ids];

}



function buildSlots(ctx, slotConfig = {}) {

  const slots = [];

  const { goal, fitnessLevel, activityLevel, supplementsBudget, isVegan, weightKg } =

    ctx;



  const wantsProtein =

    !isVegan &&

    !supplementsTextMentions(supplementsBudget, [/\bwhey\b/, /\bprotein powder\b/, /\bisolate\b/]) &&

    (goal !== 'endurance' || (weightKg != null && weightKg >= 55));



  if (wantsProtein) {

    slots.push({ slot: 'protein', categorySlug: 'whey-protein', reasonKey: 'protein' });

  }



  const wantsCreatine =

    (goal === 'muscle' || goal === 'lose') &&

    !supplementsTextMentions(supplementsBudget, [/\bcreatine\b/]);



  if (wantsCreatine) {

    slots.push({ slot: 'creatine', categorySlug: 'creatine', reasonKey: 'creatine' });

  }



  const includeShaker = slotConfig.includeShaker !== false;

  if (includeShaker && slots.some((s) => s.slot === 'protein')) {

    slots.push({ slot: 'shaker', categorySlug: 'shakers', reasonKey: 'shaker' });

  }



  const wantsPreWorkout =

    goal === 'endurance' ||

    (/advanced|intermediate/i.test(String(fitnessLevel || '')) &&

      /very|high|active|athlete/i.test(String(activityLevel || '')));



  if (

    wantsPreWorkout &&

    !supplementsTextMentions(supplementsBudget, [/\bpre[\s-]?workout\b/, /\bpreworkout\b/])

  ) {

    slots.push({ slot: 'pre_workout', categorySlug: 'pre-workout', reasonKey: 'preWorkout' });

  }



  return slots.slice(0, 4);

}



/** Extra slots used when the primary bundle has fewer than the target count. */
function buildFallbackSlots(ctx, slotConfig = {}) {
  const { goal } = ctx;
  const includeShaker = slotConfig.includeShaker !== false;

  const fallbacks = [
    { slot: 'creatine', categorySlugs: ['creatine', 'monohydrate'], reasonKey: 'creatine' },
    ...(includeShaker
      ? [{ slot: 'shaker', categorySlugs: ['shakers'], reasonKey: 'shaker' }]
      : []),
    { slot: 'pre_workout', categorySlugs: ['pre-workout'], reasonKey: 'preWorkout' },
    { slot: 'protein_bar', categorySlugs: ['protein-bars', 'high-protein'], reasonKey: 'protein' },
    { slot: 'vitamins', categorySlugs: ['vitamins', 'vitamins-2', 'vitamins-supplements'], reasonKey: 'proteinGeneric' },
  ];

  if (goal === 'endurance') {
    fallbacks.unshift({
      slot: 'pre_workout',
      categorySlugs: ['pre-workout', 'bcaa-eaa-glutamine'],
      reasonKey: 'preWorkout',
    });
  }

  return fallbacks;
}



async function appendSlotProduct(picked, usedIds, slotDef, ctx, locale) {
  if (picked.some((row) => row.slot === slotDef.slot)) return false;

  const product = await pickProductInCategories(slotDef.categorySlugs || [slotDef.categorySlug], usedIds, {
    slot: slotDef.slot,
    goalKey: ctx.goalKey,
    proteinTargetG: ctx.proteinTargetG,
  });
  if (!product) return false;

  usedIds.push(product.id);

  const reasonCtx = {
    goalKey: ctx.goalKey,
    primaryGoal: ctx.primaryGoal,
    proteinTargetG: ctx.proteinTargetG,
    trainingDaysPerWeek: ctx.trainingDaysPerWeek,
    fitnessLevel: ctx.fitnessLevel,
  };
  const reasonEn = buildReasonCopy(slotDef.slot, reasonCtx, 'en');
  const reasonAr = buildReasonCopy(slotDef.slot, reasonCtx, 'ar');

  picked.push({
    slot: slotDef.slot,
    reasonKey: slotDef.reasonKey,
    reasonEn,
    reasonAr,
    reason: locale === 'en' ? reasonEn : reasonAr,
    product,
  });
  return true;
}



function applyBundleDiscount(subtotal, productCount, settings) {

  if (productCount < settings.bundleDiscountMinItems) {

    return { discountedSubtotal: subtotal, discountAmount: 0, discountPercent: 0 };

  }

  const discountPercent = settings.bundleDiscountPercent;

  const discountAmount = Math.round(subtotal * (discountPercent / 100) * 100) / 100;

  return {

    discountedSubtotal: Math.round((subtotal - discountAmount) * 100) / 100,

    discountAmount,

    discountPercent,

  };

}



/**

 * @param {string} userId

 * @param {{ locale?: 'en'|'ar', sessionId?: string }} [opts]

 */

async function getPlanProductRecommendations(userId, opts = {}) {

  const locale = opts.locale === 'en' ? 'en' : 'ar';

  const sessionId = opts.sessionId || newCommerceSessionId();

  const settings = getCommerceSettings();



  const profile = await prisma.athleteProfile.findUnique({

    where: { userId },

    select: {

      weight: true,

      gender: true,

      fitnessGoal: true,

      onboardingData: true,

    },

  });



  const onboardingRaw =

    profile?.onboardingData && typeof profile.onboardingData === 'object'

      ? profile.onboardingData

      : {};

  const extracted = extractOnboardingForCoach(onboardingRaw);

  const flat = extracted.flat || {};

  const primaryGoal = flat.primaryGoal || profile?.fitnessGoal || onboardingRaw.primaryGoal || null;

  const gKey = goalKey(primaryGoal);

  const trainingDaysPerWeek =

    Number(flat.trainingDaysPerWeek ?? onboardingRaw.trainingDaysPerWeek) ||

    Number(onboardingRaw.trainingDaysPerWeek) ||

    null;



  const targets = estimateDailyTargets({

    weight: profile?.weight ?? onboardingRaw.weight,

    gender: profile?.gender ?? onboardingRaw.gender,

    fitnessGoal: primaryGoal,

    dateOfBirth: onboardingRaw.dateOfBirth ?? onboardingRaw.birthDate,

    medicalNotes: onboardingRaw.medicalNotes,

    onboardingData: onboardingRaw,

  });



  const suppNorm = normalizeSupplementsBudget(
    onboardingRaw.supplementsBudget ?? flat.supplementsBudget ?? '',
  );

  const ctx = {

    goal: gKey,

    goalKey: gKey,

    weightKg: Number(profile?.weight ?? onboardingRaw.weight) || null,

    gender: profile?.gender ?? onboardingRaw.gender ?? null,

    fitnessLevel: flat.fitnessLevel ?? onboardingRaw.fitnessLevel ?? null,

    activityLevel: flat.activityLevel ?? onboardingRaw.activityLevel ?? null,

    supplementsBudget: suppNorm.text,

    isVegan: isVeganOrPlantOnly(onboardingRaw, flat),

    proteinTargetG: targets?.proteinTarget ?? null,

    primaryGoal,

    trainingDaysPerWeek,

  };



  const excludeIds = [...(await recentOrderedProductIds(userId)), ...suppNorm.productIds];

  const abAssignment = await assignAbVariant(userId);

  const slotConfig =

    abAssignment?.slotConfig && typeof abAssignment.slotConfig === 'object'

      ? abAssignment.slotConfig

      : {};

  const slots = buildSlots(ctx, slotConfig);

  const picked = [];

  const usedIds = [...excludeIds];



  for (const slot of slots) {

    const product = await pickProductInCategories([slot.categorySlug], usedIds, {

      slot: slot.slot,

      goalKey: gKey,

      proteinTargetG: ctx.proteinTargetG,

    });

    if (!product) continue;

    usedIds.push(product.id);



    const reasonCtx = {

      goalKey: gKey,

      primaryGoal,

      proteinTargetG: ctx.proteinTargetG,

      trainingDaysPerWeek,

      fitnessLevel: ctx.fitnessLevel,

    };

    const reasonEn = buildReasonCopy(slot.slot, reasonCtx, 'en');

    const reasonAr = buildReasonCopy(slot.slot, reasonCtx, 'ar');



    picked.push({

      slot: slot.slot,

      reasonKey: slot.reasonKey,

      reasonEn,

      reasonAr,

      reason: locale === 'en' ? reasonEn : reasonAr,

      product,

    });

  }



  const targetCount = Math.max(3, settings.bundleDiscountMinItems || 3);

  const fillCtx = { ...ctx, goalKey: gKey, primaryGoal, trainingDaysPerWeek };

  if (picked.length < targetCount) {
    for (const slotDef of buildFallbackSlots(fillCtx, slotConfig)) {
      if (picked.length >= targetCount) break;
      await appendSlotProduct(picked, usedIds, slotDef, fillCtx, locale);
    }
  }

  if (picked.length < targetCount) {
    const extras = await prisma.product.findMany({
      where: {
        isActive: true,
        stock: { gt: 0 },
        ...(usedIds.length ? { id: { notIn: usedIds } } : {}),
      },
      take: 30,
      orderBy: [{ salesCount: 'desc' }, { avgRating: 'desc' }],
      select: PRODUCT_SELECT,
    });
    const ranked = rankProducts(extras, { goalKey: gKey, proteinTargetG: ctx.proteinTargetG }, {
      lowStockThreshold: getLowStockThreshold(),
    });
    for (const row of ranked) {
      if (picked.length >= targetCount) break;
      if (!row?.product || usedIds.includes(row.product.id)) continue;
      usedIds.push(row.product.id);
      const normalized = normalizeProduct(row.product);
      const reasonEn = buildReasonCopy('fbt', { goalKey: gKey, primaryGoal, proteinTargetG: ctx.proteinTargetG, trainingDaysPerWeek, fitnessLevel: ctx.fitnessLevel }, 'en');
      const reasonAr = buildReasonCopy('fbt', { goalKey: gKey, primaryGoal, proteinTargetG: ctx.proteinTargetG, trainingDaysPerWeek, fitnessLevel: ctx.fitnessLevel }, 'ar');
      picked.push({
        slot: 'popular',
        reasonKey: 'fbt',
        reasonEn,
        reasonAr,
        reason: locale === 'en' ? reasonEn : reasonAr,
        product: normalized,
      });
    }
  }



  const subtotal = picked.reduce((sum, row) => sum + Number(row.product.price || 0), 0);

  const currency = picked[0]?.product.currency || 'EGP';

  const discount = applyBundleDiscount(subtotal, picked.length, settings);

  const reasonCtx = {
    goalKey: gKey,
    primaryGoal,
    proteinTargetG: ctx.proteinTargetG,
    trainingDaysPerWeek,
    fitnessLevel: ctx.fitnessLevel,
  };

  let frequentlyBoughtTogether = [];
  if (picked[0]?.product?.id) {
    const fbt = await getFrequentlyBoughtTogether(picked[0].product.id, {
      limit: 3,
      excludeIds: usedIds,
    });
    frequentlyBoughtTogether = fbt.map((row) => ({
      slot: 'fbt',
      reasonKey: 'fbt',
      reasonEn: buildReasonCopy('fbt', reasonCtx, 'en'),
      reasonAr: buildReasonCopy('fbt', reasonCtx, 'ar'),
      reason:
        locale === 'en' ? buildReasonCopy('fbt', reasonCtx, 'en') : buildReasonCopy('fbt', reasonCtx, 'ar'),
      coOccurrenceCount: row.coOccurrenceCount,
      product: row.product,
    }));
  }

  return {

    sessionId,

    bundleId: `plan-${gKey}-v1`,

    bundleTitle: bundleTitleForGoal(gKey, locale),

    locale,

    basedOn: {

      goal: primaryGoal,

      weightKg: ctx.weightKg,

      gender: ctx.gender,

      fitnessLevel: ctx.fitnessLevel,

      proteinTargetG: ctx.proteinTargetG,

      trainingDaysPerWeek,

    },

    products: picked,

    frequentlyBoughtTogether,

    subtotal: Math.round(subtotal * 100) / 100,

    discountPercent: discount.discountPercent,

    discountAmount: discount.discountAmount,

    total: discount.discountedSubtotal,

    currency,

    empty: picked.length === 0,

    abTest: abAssignment

      ? {

          experimentId: abAssignment.experimentId,

          experimentSlug: abAssignment.experimentSlug,

          variantKey: abAssignment.variantKey,

          variantName: abAssignment.variantName,

        }

      : null,

  };

}



/**

 * Validate AI bundle discount at checkout.

 */

function validateAiBundleDiscount(items, bundleProductIds, settings = getCommerceSettings()) {

  const cartIds = items.map((i) => i.productId).sort();

  const bundleIds = [...bundleProductIds].sort();

  if (cartIds.length < settings.bundleDiscountMinItems) return null;

  if (cartIds.length !== bundleIds.length) return null;

  for (let i = 0; i < cartIds.length; i++) {

    if (cartIds[i] !== bundleIds[i]) return null;

  }

  return {

    discountPercent: settings.bundleDiscountPercent,

  };

}



function buildEmptyRecommendationBundle(locale = 'ar', sessionId) {
  return {
    sessionId: sessionId || newCommerceSessionId(),
    bundleId: 'empty',
    bundleTitle: bundleTitleForGoal(null, locale),
    locale,
    basedOn: {
      goal: null,
      weightKg: null,
      gender: null,
      fitnessLevel: null,
      proteinTargetG: null,
      trainingDaysPerWeek: null,
    },
    products: [],
    frequentlyBoughtTogether: [],
    subtotal: 0,
    discountPercent: 0,
    discountAmount: 0,
    total: 0,
    currency: 'EGP',
    empty: true,
    abTest: null,
  };
}

module.exports = {

  getPlanProductRecommendations,

  buildEmptyRecommendationBundle,
  buildSlots,

  buildFallbackSlots,

  pickProductInCategory,

  pickProductInCategories,

  validateAiBundleDiscount,

  applyBundleDiscount,

};


