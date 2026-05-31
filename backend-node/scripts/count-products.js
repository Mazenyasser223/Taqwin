const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.product
  .groupBy({ by: ['isActive'], _count: true })
  .then(async (groups) => {
    const catalog = await p.product.count({ where: { slug: { not: null } } });
    const activeCatalog = await p.product.count({ where: { isActive: true, slug: { not: null } } });
    const legacy = await p.product.count({ where: { slug: null } });
    const total = await p.product.count();
    console.log({ total, activeCatalog, catalogWithSlug: catalog, legacyInactive: legacy, byActive: groups });
  })
  .finally(() => p.$disconnect());
