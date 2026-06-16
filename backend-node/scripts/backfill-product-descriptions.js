/**
 * Backfill product descriptions by scraping MFB product pages.
 * Usage: node scripts/backfill-product-descriptions.js [--limit=100] [--force]
 */
const { PrismaClient } = require('@prisma/client');
const { fetchProductDescription } = require('./lib/scrapeMfbDescription');

const prisma = new PrismaClient();
const DELAY_MS = 450;
const CONCURRENCY = 3;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function needsBackfill(row, force) {
  if (force) return true;
  const d = row.description || '';
  if (!d.trim() || d.length < 100) return true;
  // Taqwin auto-generated highlights (wrong category / generic)
  if (/<h3><b>Key Highlights:<\/b><\/h3>/i.test(d) && /<b>Category:<\/b>/i.test(d)) return true;
  // Rich MFB HTML with section headings
  if (/<h[1-4][^>]*>\s*(Key Highlights|Key Benefits|How to Use)/i.test(d)) return false;
  // Mostly plain text from import — needs full HTML from MFB
  if (!/<[a-z][\s\S]{50,}/i.test(d)) return true;
  return false;
}

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : null;
  const force = process.argv.includes('--force');

  const categorySlug = process.argv.find((a) => a.startsWith('--category='))?.split('=')[1];

  let categoryIds = null;
  if (categorySlug) {
    const cat = await prisma.shopCategory.findUnique({ where: { slug: categorySlug } });
    if (cat) {
      const all = await prisma.shopCategory.findMany({ select: { id: true, parentId: true } });
      categoryIds = [cat.id];
      const queue = [cat.id];
      while (queue.length) {
        const pid = queue.shift();
        for (const c of all.filter((x) => x.parentId === pid)) {
          categoryIds.push(c.id);
          queue.push(c.id);
        }
      }
    }
  }

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      slug: { not: null },
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
    },
    select: { id: true, slug: true, description: true },
    orderBy: { name: 'asc' },
  });

  const queue = products.filter((p) => needsBackfill(p, force));
  const toProcess = limit ? queue.slice(0, limit) : queue;

  console.log('[backfill] active', products.length, 'to update', toProcess.length, force ? '(force)' : '');

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const batch = toProcess.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (row) => {
        const r = await fetchProductDescription(row.slug);
        await sleep(DELAY_MS);
        if (!r.html) {
          failed += 1;
          if (failed <= 10) console.log('[fail]', row.slug, r.error);
          return;
        }
        await prisma.product.update({
          where: { id: row.id },
          data: { description: r.html },
        });
        updated += 1;
        if (updated % 25 === 0) {
          console.log(`[backfill] progress ${updated}/${toProcess.length}`);
        }
      })
    );
  }

  skipped = products.length - toProcess.length;
  const audit = await prisma.product.findMany({
    where: { isActive: true },
    select: { description: true },
  });
  let kh = 0;
  let htu = 0;
  let both = 0;
  let empty = 0;
  for (const p of audit) {
    const d = p.description || '';
    if (!d.trim()) {
      empty += 1;
      continue;
    }
    const a = /key\s*highlights/i.test(d);
    const b = /how\s+to\s+use/i.test(d);
    if (a) kh += 1;
    if (b) htu += 1;
    if (a && b) both += 1;
  }

  console.log('[backfill] done', { updated, failed, skipped, empty, withKeyHighlights: kh, withHowToUse: htu, withBoth: both });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
