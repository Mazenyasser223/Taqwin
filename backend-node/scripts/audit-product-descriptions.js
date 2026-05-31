/**
 * Audit product descriptions for Key Highlights / How to Use coverage.
 */
const { PrismaClient } = require('@prisma/client');
const { productHasAllSections } = require('../src/lib/ensureProductDescription');
const prisma = new PrismaClient();

function hasPattern(text, pattern) {
  return pattern.test(String(text || ''));
}

async function main() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      slug: true,
      name: true,
      description: true,
      descriptionAr: true,
    },
  });

  let withDesc = 0;
  let withKeyHighlights = 0;
  let withHowToUse = 0;
  let withBoth = 0;
  let withAllSections = 0;
  let empty = 0;
  const samplesMissing = [];

  for (const p of products) {
    const d = p.description || '';
    if (!d.trim()) {
      empty += 1;
      if (samplesMissing.length < 8) {
        samplesMissing.push({ slug: p.slug, name: p.name?.slice(0, 60), reason: 'no description' });
      }
      continue;
    }
    withDesc += 1;
    const kh = hasPattern(d, /key\s*highlights/i);
    const htu = hasPattern(d, /how\s+to\s+use/i);
    if (kh) withKeyHighlights += 1;
    if (htu) withHowToUse += 1;
    if (kh && htu) withBoth += 1;
    if (productHasAllSections(d)) withAllSections += 1;
    else if (samplesMissing.length < 12) {
      samplesMissing.push({
        slug: p.slug,
        name: p.name?.slice(0, 50),
        keyHighlights: kh,
        howToUse: htu,
        len: d.length,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        totalActive: products.length,
        withDescription: withDesc,
        emptyDescription: empty,
        withKeyHighlights,
        withHowToUse,
        withBothSections: withBoth,
        withAllSectionsComplete: withAllSections,
        pctWithBoth: `${((withBoth / products.length) * 100).toFixed(1)}%`,
        pctComplete: `${((withAllSections / products.length) * 100).toFixed(1)}%`,
        samplesMissingOrPartial: samplesMissing,
      },
      null,
      2
    )
  );
}

main().finally(() => prisma.$disconnect());
