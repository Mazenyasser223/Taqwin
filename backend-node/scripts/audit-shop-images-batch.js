/**
 * Sample-check product image URLs from DB.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function head(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const withImg = await prisma.product.findMany({
    where: { isActive: true, imageUrl: { not: null } },
    select: { imageUrl: true },
  });
  const noImg = await prisma.product.count({
    where: { isActive: true, OR: [{ imageUrl: null }, { imageUrl: '' }] },
  });
  const step = Math.max(1, Math.floor(withImg.length / 80));
  const sample = withImg.filter((_, i) => i % step === 0).slice(0, 80);
  let ok = 0;
  let fail = 0;
  for (const p of sample) {
    if (await head(p.imageUrl)) ok += 1;
    else fail += 1;
  }
  console.log({
    totalWithImage: withImg.length,
    missingImage: noImg,
    sampled: sample.length,
    ok,
    fail,
    passRate: `${((ok / sample.length) * 100).toFixed(1)}%`,
  });
}

main()
  .finally(() => prisma.$disconnect());
