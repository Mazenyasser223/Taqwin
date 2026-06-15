require('dotenv').config();
const jwt = require('jsonwebtoken');
const { prisma } = require('../src/db');

async function bench(url) {
  const user = await prisma.user.findUnique({
    where: { email: 'ziad74488@gmail.com' },
    select: { id: true, email: true, role: true },
  });
  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  const start = Date.now();
  const res = await fetch(`http://127.0.0.1:4000${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  console.log(url, res.status, `${Date.now() - start}ms`, `${text.length} bytes`);
}

async function main() {
  await bench('/api/admin/shop/orders?limit=50');
  await bench('/api/admin/shop/products?active=true&limit=50');
  await bench('/api/admin/shop/categories');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
