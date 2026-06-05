/**
 * Remove MFB footer/chrome from all product descriptions in DB.
 * Usage: node scripts/strip-description-chrome.js [--dry-run]
 */
const { PrismaClient } = require('@prisma/client');
const { stripProductDescriptionChrome } = require('../src/lib/stripProductDescriptionChrome');
const { ensureProductDescription } = require('../src/lib/ensureProductDescription');
const { productHasAllSections } = require('../src/lib/ensureProductDescription');

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

const POLLUTION = ['wd-footer', 'Selling premium', 'USEFUL LINKS', 'elementor-129543', '</main></div><footer'];

async function main() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: true },
  });

  let stripped = 0;
  let reEnsured = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const hadPollution = POLLUTION.some((pat) => (p.description || '').includes(pat));
    const cleaned = stripProductDescriptionChrome(p.description);
    let next = cleaned;

    if (!productHasAllSections(next)) {
      next = ensureProductDescription({ ...p, description: cleaned });
      reEnsured += 1;
    }

    if (next === (p.description || '').trim()) continue;
    stripped += 1;
    if (!dryRun) {
      await prisma.product.update({ where: { id: p.id }, data: { description: next } });
    }
    if (hadPollution && stripped <= 3) {
      console.log('[sample]', p.slug, 'len', p.description?.length, '->', next.length);
    }
    if ((i + 1) % 500 === 0) console.log(`[strip] ${i + 1}/${products.length}`);
  }

  const counts = {};
  for (const pat of POLLUTION) {
    counts[pat] = await prisma.product.count({
      where: { isActive: true, description: { contains: pat, mode: 'insensitive' } },
    });
  }

  console.log(JSON.stringify({ dryRun, stripped, reEnsured, remainingPollution: counts }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
