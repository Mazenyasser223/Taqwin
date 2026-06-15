require('dotenv').config();
const jwt = require('jsonwebtoken');
const { prisma } = require('../src/db');

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'ziad74488@gmail.com' },
    select: { id: true, email: true, role: true },
  });
  if (!user) throw new Error('admin user not found');
  console.log('user', user);

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const base = process.env.API_BASE || 'http://127.0.0.1:4000';
  const urls = [
    `${base}/api/admin/shop/products?active=true&limit=50`,
    `${base}/api/admin/shop/products?active=all&limit=50`,
    `${base}/api/admin/shop/categories`,
    `${base}/api/admin/shop/dashboard`,
    `${base}/api/admin/shop/orders?limit=50`,
  ];

  const postBody = {
    name: 'Test Admin Product',
    brand: 'Taqwin',
    categoryId: null,
    price: 99,
    stock: 10,
    isActive: true,
  };

  for (const url of urls) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const text = await res.text();
    console.log('\n---', url);
    console.log('status', res.status);
    try {
      JSON.parse(text);
      console.log('json ok, bytes', text.length);
    } catch (e) {
      console.log('JSON PARSE FAIL', e.message);
      console.log(text.slice(0, 300));
    }
  }

  const createRes = await fetch(`${base}/api/admin/shop/products`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(postBody),
  });
  const createText = await createRes.text();
  console.log('\n--- POST /products');
  console.log('status', createRes.status);
  console.log(createText.slice(0, 800));

  if (createRes.ok) {
    const created = JSON.parse(createText);
    const delRes = await fetch(`${base}/api/admin/shop/products/${created.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('cleanup delete', delRes.status);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
