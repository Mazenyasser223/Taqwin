/**
 * Resolve food item display name for user locale (ar | en).
 */
const { translateFoodNameArToEn, hasArabic: hasArabicFood } = require('./webtebFoodNameEn');
const { translateFoodNameEnToAr } = require('./foodNameEnToAr');

const webtebCache = new Map();

async function loadWebtebNames(webtebId, prisma) {
  if (!webtebId || !prisma) return null;
  if (webtebCache.has(webtebId)) return webtebCache.get(webtebId);
  const row = await prisma.webtebFood.findUnique({
    where: { webtebId },
    select: { nameAr: true, nameEn: true },
  });
  if (row) webtebCache.set(webtebId, row);
  return row;
}

/**
 * @param {{ id?: string, name?: string, webtebId?: number|null }} food
 * @param {'ar'|'en'} locale
 * @param {import('@prisma/client').PrismaClient} [prisma]
 */
async function resolveFoodDisplayName(food, locale = 'ar', prisma) {
  if (!food?.name) return locale === 'ar' ? 'وجبة' : 'Meal';

  let nameAr = String(food.name).trim();
  let nameEn = null;

  if (food.webtebId) {
    const wf = await loadWebtebNames(food.webtebId, prisma);
    if (wf) {
      nameAr = wf.nameAr || nameAr;
      nameEn = wf.nameEn || null;
    }
  }

  if (locale === 'ar') {
    if (hasArabicFood(nameAr)) return nameAr;
    if (nameEn) return translateFoodNameEnToAr(nameEn, { delayMs: 0 });
    return translateFoodNameEnToAr(nameAr, { delayMs: 0 });
  }

  if (nameEn) return nameEn;
  if (hasArabicFood(nameAr)) {
    return (await translateFoodNameArToEn(nameAr, { delayMs: 0 })) || nameAr;
  }
  return nameAr;
}

module.exports = {
  resolveFoodDisplayName,
};
