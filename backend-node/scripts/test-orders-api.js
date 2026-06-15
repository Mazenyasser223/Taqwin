require('dotenv').config();
const jwt = require('jsonwebtoken');
const { prisma } = require('../src/db');

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'ziad74488@gmail.com' },
    select: { id: true, email: true, role: true },
  });
  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  const res = await fetch('http://127.0.0.1:4000/api/admin/shop/orders?limit=50', {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('orders status', res.status);
  if (!res.ok) console.log(await res.text());
  else {
    const data = await res.json();
    console.log('items', data.items?.length);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
