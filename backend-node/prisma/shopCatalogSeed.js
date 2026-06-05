/**
 * Demo shop catalog (My Fitness Bag–style tree) for graduation.
 * Generic placeholder images — not scraped from external sites.
 */

const IMG = {
  protein: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=600&q=80',
  creatine: 'https://images.unsplash.com/photo-1579722821273-2f0379ebc6b0?w=600&q=80',
  preworkout: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?w=600&q=80',
  vitamins: 'https://images.unsplash.com/photo-1550572017-edd951aa6b8d?w=600&q=80',
  bands: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80',
  dumbbell: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80',
  belt: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&q=80',
  mat: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=600&q=80',
  bottle: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&q=80',
  apparel: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80',
  shaker: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef48?w=600&q=80',
  bcaa: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50e?w=600&q=80',
};

/** @type {{ slug: string; nameEn: string; nameAr?: string; icon?: string; sortOrder: number; children?: { slug: string; nameEn: string; nameAr?: string; sortOrder: number }[] }[]} */
const CATEGORY_TREE = [
  {
    slug: 'supplements',
    nameEn: 'Supplements',
    nameAr: 'مكملات غذائية',
    icon: 'medication',
    sortOrder: 1,
    children: [
      { slug: 'protein', nameEn: 'Protein', nameAr: 'بروتين', sortOrder: 1 },
      { slug: 'creatine', nameEn: 'Creatine', nameAr: 'كرياتين', sortOrder: 2 },
      { slug: 'pre-workout', nameEn: 'Pre-Workout', nameAr: 'قبل التمرين', sortOrder: 3 },
      { slug: 'vitamins', nameEn: 'Vitamins', nameAr: 'فيتامينات', sortOrder: 4 },
      { slug: 'amino-acids', nameEn: 'Amino Acids', nameAr: 'أحماض أمينية', sortOrder: 5 },
    ],
  },
  {
    slug: 'equipment',
    nameEn: 'Equipment',
    nameAr: 'معدات',
    icon: 'fitness_center',
    sortOrder: 2,
    children: [
      { slug: 'bands', nameEn: 'Resistance Bands', nameAr: 'حبال مقاومة', sortOrder: 1 },
      { slug: 'weights', nameEn: 'Weights', nameAr: 'أوزان', sortOrder: 2 },
      { slug: 'accessories-gym', nameEn: 'Gym Accessories', nameAr: 'إكسسوارات الجيم', sortOrder: 3 },
    ],
  },
  {
    slug: 'apparel',
    nameEn: 'Apparel',
    nameAr: 'ملابس رياضية',
    icon: 'checkroom',
    sortOrder: 3,
    children: [
      { slug: 'tops', nameEn: 'Tops', nameAr: 'تيشيرتات', sortOrder: 1 },
      { slug: 'bottoms', nameEn: 'Bottoms', nameAr: 'بناطيل', sortOrder: 2 },
    ],
  },
  {
    slug: 'accessories',
    nameEn: 'Accessories',
    nameAr: 'إكسسوارات',
    icon: 'water_drop',
    sortOrder: 4,
    children: [
      { slug: 'hydration', nameEn: 'Hydration', nameAr: 'ترطيب', sortOrder: 1 },
      { slug: 'recovery', nameEn: 'Recovery', nameAr: 'استشفاء', sortOrder: 2 },
    ],
  },
  {
    slug: 'offers',
    nameEn: 'Offers',
    nameAr: 'عروض',
    icon: 'local_offer',
    sortOrder: 5,
    children: [],
  },
];

/**
 * @param {string} categorySlug
 * @param {object} p
 */
function product(categorySlug, p) {
  const compareAt = p.compareAtPrice ?? null;
  const price = p.price;
  let discountPercent = p.discountPercent ?? null;
  if (compareAt && compareAt > price && !discountPercent) {
    discountPercent = Math.round(((compareAt - price) / compareAt) * 100);
  }
  const isOnSale = p.isOnSale ?? Boolean(compareAt && compareAt > price);
  return {
    slug: p.slug,
    name: p.name,
    nameAr: p.nameAr ?? null,
    brand: p.brand,
    categorySlug,
    price,
    compareAtPrice: compareAt,
    currency: 'EGP',
    discountPercent,
    priceMin: p.priceMin ?? null,
    priceMax: p.priceMax ?? null,
    hasVariants: p.hasVariants ?? false,
    imageUrl: p.imageUrl,
    description: p.description,
    descriptionAr: p.descriptionAr ?? null,
    stock: p.stock ?? 50,
    isOnSale,
    isFeatured: p.isFeatured ?? false,
    isActive: true,
    sortOrder: p.sortOrder ?? 0,
  };
}

const SHOP_PRODUCTS = [
  product('protein', {
    slug: 'whey-isolate-vanilla-2kg',
    name: 'Whey Protein Isolate 2kg — Vanilla',
    nameAr: 'واي بروتين معزول ٢ كجم — فانيليا',
    brand: 'Taqwin Labs',
    price: 1899,
    compareAtPrice: 2299,
    imageUrl: IMG.protein,
    description: '25g protein per scoop. Cold-filtered isolate.',
    descriptionAr: '٢٥ جم بروتين للمكيال. معزول بترشيح بارد.',
    stock: 120,
    isFeatured: true,
    sortOrder: 1,
  }),
  product('protein', {
    slug: 'whey-concentrate-chocolate-1kg',
    name: 'Whey Concentrate 1kg — Chocolate',
    nameAr: 'واي مركز ١ كجم — شوكولاتة',
    brand: 'Optimum Nutrition',
    price: 1099,
    compareAtPrice: 1299,
    imageUrl: IMG.protein,
    description: 'Classic whey blend for daily shakes.',
    stock: 85,
    sortOrder: 2,
  }),
  product('protein', {
    slug: 'casein-night-blend',
    name: 'Casein Night Blend 900g',
    nameAr: 'كازين ليلي ٩٠٠ جم',
    brand: 'Dymatize',
    price: 1249,
    imageUrl: IMG.protein,
    description: 'Slow-release protein before sleep.',
    stock: 40,
    sortOrder: 3,
  }),
  product('creatine', {
    slug: 'creatine-monohydrate-300g',
    name: 'Creatine Monohydrate 300g',
    nameAr: 'كرياتين مونوهيدرات ٣٠٠ جم',
    brand: 'Taqwin Labs',
    price: 449,
    compareAtPrice: 549,
    imageUrl: IMG.creatine,
    description: 'Micronized 5g daily dose.',
    stock: 200,
    isFeatured: true,
    sortOrder: 1,
  }),
  product('creatine', {
    slug: 'creatine-hcl-120caps',
    name: 'Creatine HCL 120 Caps',
    nameAr: 'كرياتين HCL ١٢٠ كبسولة',
    brand: 'Kaged',
    price: 699,
    imageUrl: IMG.creatine,
    description: 'Highly soluble creatine capsules.',
    stock: 60,
    sortOrder: 2,
  }),
  product('pre-workout', {
    slug: 'pre-workout-edge-30srv',
    name: 'Pre-Workout Edge — 30 Servings',
    nameAr: 'بري ورك أوت Edge — ٣٠ حصة',
    brand: 'Taqwin Labs',
    price: 899,
    compareAtPrice: 1099,
    imageUrl: IMG.preworkout,
    description: 'Caffeine, beta-alanine, L-citrulline.',
    stock: 90,
    sortOrder: 1,
  }),
  product('pre-workout', {
    slug: 'c4-original-30srv',
    name: 'C4 Original Pre-Workout',
    nameAr: 'سي فور أوريجينال',
    brand: 'Cellucor',
    price: 949,
    imageUrl: IMG.preworkout,
    description: 'Explosive energy and pumps.',
    stock: 55,
    sortOrder: 2,
  }),
  product('vitamins', {
    slug: 'multivitamin-athlete-60',
    name: 'Athlete Multivitamin — 60 Tabs',
    nameAr: 'مالتي فيتامين للرياضيين',
    brand: 'Universal',
    price: 399,
    compareAtPrice: 499,
    imageUrl: IMG.vitamins,
    description: 'Daily micronutrients for active lifestyles.',
    stock: 150,
    sortOrder: 1,
  }),
  product('vitamins', {
    slug: 'omega-3-fish-oil-90',
    name: 'Omega-3 Fish Oil — 90 Softgels',
    nameAr: 'أوميجا ٣ — ٩٠ كبسولة',
    brand: 'Now Sports',
    price: 349,
    imageUrl: IMG.vitamins,
    description: 'EPA/DHA for heart and joint health.',
    stock: 100,
    sortOrder: 2,
  }),
  product('amino-acids', {
    slug: 'bcaa-2-1-1-400g',
    name: 'BCAA 2:1:1 — 400g',
    nameAr: 'بي سي أي إيه ٢:١:١',
    brand: 'Scivation',
    price: 649,
    compareAtPrice: 799,
    imageUrl: IMG.bcaa,
    description: 'Intra-workout amino support.',
    stock: 70,
    sortOrder: 1,
  }),
  product('bands', {
    slug: 'resistance-bands-set-5',
    name: 'Resistance Bands Set (5 Levels)',
    nameAr: 'طقم حبال مقاومة — ٥ مستويات',
    brand: 'IronMile',
    price: 599,
    compareAtPrice: 749,
    imageUrl: IMG.bands,
    description: 'Loop bands with door anchor.',
    stock: 80,
    sortOrder: 1,
  }),
  product('weights', {
    slug: 'adjustable-dumbbell-24kg',
    name: 'Adjustable Dumbbell Pair — 24kg',
    nameAr: 'دمبل قابل للتعديل — ٢٤ كجم',
    brand: 'IronMile',
    price: 8999,
    compareAtPrice: 10499,
    imageUrl: IMG.dumbbell,
    description: 'Tool-free 5–24kg adjustment.',
    stock: 25,
    isFeatured: true,
    sortOrder: 1,
  }),
  product('accessories-gym', {
    slug: 'leather-lifting-belt',
    name: 'Leather Lifting Belt 10mm',
    nameAr: 'حزام رفع جلد ١٠ مم',
    brand: 'IronMile',
    price: 1299,
    imageUrl: IMG.belt,
    description: 'Prong buckle, competition width.',
    stock: 60,
    sortOrder: 1,
  }),
  product('tops', {
    slug: 'performance-tee-black',
    name: 'Performance Tee — Black',
    nameAr: 'تيشيرت أداء — أسود',
    brand: 'Taqwin Apparel',
    price: 449,
    compareAtPrice: 549,
    imageUrl: IMG.apparel,
    description: 'Moisture-wicking athletic fit.',
    stock: 200,
    hasVariants: true,
    priceMin: 449,
    priceMax: 499,
    sortOrder: 1,
  }),
  product('tops', {
    slug: 'compression-long-sleeve',
    name: 'Compression Long Sleeve',
    nameAr: 'كم طويل ضاغط',
    brand: 'Under Armour',
    price: 899,
    imageUrl: IMG.apparel,
    description: 'Second-skin base layer.',
    stock: 90,
    sortOrder: 2,
  }),
  product('bottoms', {
    slug: 'training-joggers-grey',
    name: 'Training Joggers — Grey',
    nameAr: 'بنطلون تمرين — رمادي',
    brand: 'Taqwin Apparel',
    price: 699,
    compareAtPrice: 849,
    imageUrl: IMG.apparel,
    description: 'Tapered fit with zip pockets.',
    stock: 110,
    sortOrder: 1,
  }),
  product('hydration', {
    slug: 'smart-bottle-1l',
    name: 'Smart Water Bottle 1L',
    nameAr: 'زجاجة ماء ذكية ١ لتر',
    brand: 'Hydra',
    price: 349,
    imageUrl: IMG.bottle,
    description: 'Tracks intake, BPA-free.',
    stock: 150,
    sortOrder: 1,
  }),
  product('hydration', {
    slug: 'shaker-pro-700ml',
    name: 'Pro Shaker 700ml',
    nameAr: 'شيكر برو ٧٠٠ مل',
    brand: 'BlenderBottle',
    price: 199,
    compareAtPrice: 249,
    imageUrl: IMG.shaker,
    description: 'Wire whisk ball included.',
    stock: 300,
    sortOrder: 2,
  }),
  product('recovery', {
    slug: 'yoga-mat-pro-6mm',
    name: 'Yoga Mat Pro 6mm',
    nameAr: 'سجادة يوغا برو ٦ مم',
    brand: 'FlowState',
    price: 799,
    compareAtPrice: 999,
    imageUrl: IMG.mat,
    description: 'Grippy TPE, carry strap.',
    stock: 75,
    sortOrder: 1,
  }),
  product('recovery', {
    slug: 'foam-roller-hd-18in',
    name: 'Foam Roller HD 18"',
    nameAr: 'فوم رولر ١٨ بوصة',
    brand: 'FlowState',
    price: 449,
    imageUrl: IMG.mat,
    description: 'High-density myofascial release.',
    stock: 100,
    sortOrder: 2,
  }),
  product('offers', {
    slug: 'starter-stack-bundle',
    name: 'Starter Stack Bundle',
    nameAr: 'باقة المبتدئين',
    brand: 'Taqwin Labs',
    price: 2199,
    compareAtPrice: 2799,
    imageUrl: IMG.protein,
    description: 'Whey 1kg + Creatine + Shaker.',
    stock: 40,
    isOnSale: true,
    isFeatured: true,
    sortOrder: 1,
  }),
  product('offers', {
    slug: 'home-gym-mini-kit',
    name: 'Home Gym Mini Kit',
    nameAr: 'طقم جيم منزلي صغير',
    brand: 'IronMile',
    price: 1499,
    compareAtPrice: 1999,
    imageUrl: IMG.bands,
    description: 'Bands + mat + shaker.',
    stock: 35,
    isOnSale: true,
    sortOrder: 2,
  }),
];

async function seedShopCatalog(prisma) {
  // Hide legacy USD demo rows (no slug) after catalog migration
  await prisma.product.updateMany({
    where: { slug: null },
    data: { isActive: false },
  });

  const slugToId = new Map();

  for (const parent of CATEGORY_TREE) {
    const parentRow = await prisma.shopCategory.upsert({
      where: { slug: parent.slug },
      create: {
        slug: parent.slug,
        nameEn: parent.nameEn,
        nameAr: parent.nameAr,
        icon: parent.icon,
        sortOrder: parent.sortOrder,
      },
      update: {
        nameEn: parent.nameEn,
        nameAr: parent.nameAr,
        icon: parent.icon,
        sortOrder: parent.sortOrder,
      },
    });
    slugToId.set(parent.slug, parentRow.id);

    for (const child of parent.children ?? []) {
      const childRow = await prisma.shopCategory.upsert({
        where: { slug: child.slug },
        create: {
          slug: child.slug,
          nameEn: child.nameEn,
          nameAr: child.nameAr,
          parentId: parentRow.id,
          sortOrder: child.sortOrder,
        },
        update: {
          nameEn: child.nameEn,
          nameAr: child.nameAr,
          parentId: parentRow.id,
          sortOrder: child.sortOrder,
        },
      });
      slugToId.set(child.slug, childRow.id);
    }
  }

  let productCount = 0;
  for (const p of SHOP_PRODUCTS) {
    const categoryId = slugToId.get(p.categorySlug) ?? null;
    const { categorySlug, ...data } = p;
    await prisma.product.upsert({
      where: { slug: data.slug },
      create: { ...data, categoryId },
      update: { ...data, categoryId },
    });
    productCount += 1;
  }

  return { categories: slugToId.size, products: productCount };
}

module.exports = { seedShopCatalog, CATEGORY_TREE, SHOP_PRODUCTS };
