/**
 * Second pass: remaining non-sports roots + corrupted brand fields.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ARCHIVE_ROOTS = new Set(['kitchen', 'healthy-groceries']);

function decodeHtml(s) {
  return String(s || '').replace(/&amp;/g, '&').replace(/&#8211;/g, '–').trim();
}

function looksLikeProductTitle(brand) {
  const b = decodeHtml(brand);
  if (b.length > 42) return true;
  return /\b(dumbbell|rack|gloves|shaker bottle|pedal|machine|treadmill|bench)\b/i.test(b);
}

function inferBrand(name, current) {
  const n = decodeHtml(name);
  const known = [
    'Optimum Nutrition',
    'MyProtein',
    'MuscleTech',
    'NOW Foods',
    'Applied Nutrition',
    'Optimum Nutrition',
    'Dymatize',
    'Cellucor',
    'Universal',
    'Scivation',
    'IronMile',
    'Taqwin Labs',
    'ADIDAS',
    'NIKE',
    'Puma',
    'Under Armour',
  ];
  for (const k of known) {
    if (n.toLowerCase().includes(k.toLowerCase())) return k;
  }
  if (/^adidas/i.test(n)) return 'ADIDAS';
  if (/^nike/i.test(n)) return 'NIKE';
  if (/^puma/i.test(n)) return 'Puma';
  const first = n.split(/[\s,–\-|]+/)[0];
  if (first && first.length <= 24 && !/^\d/.test(first)) return first;
  return current.length <= 32 ? current : 'General';
}

async function main() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: { include: { parent: { include: { parent: true } } } } },
  });

  let archived = 0;
  let brandsFixed = 0;

  for (const p of products) {
    const path = [];
    let c = p.category;
    while (c) {
      path.unshift(c.slug);
      c = c.parent;
    }
    const root = path[0];

    if (root && ARCHIVE_ROOTS.has(root)) {
      await prisma.product.update({ where: { id: p.id }, data: { isActive: false } });
      archived += 1;
      continue;
    }

    if (looksLikeProductTitle(p.brand)) {
      const brand = inferBrand(p.name, p.brand);
      if (brand !== p.brand) {
        await prisma.product.update({ where: { id: p.id }, data: { brand } });
        brandsFixed += 1;
      }
    }
  }

  const active = await prisma.product.count({ where: { isActive: true } });
  console.log(JSON.stringify({ archived, brandsFixed, activeAfter: active }, null, 2));
}

main().finally(() => prisma.$disconnect());
