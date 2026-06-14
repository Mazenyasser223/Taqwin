const jwt = require('jsonwebtoken');
const http = require('http');
const { prisma } = require('../src/db');

const JWT = process.env.JWT_SECRET || 'taqwin-dev-secret-change-in-production-min-32-chars';

function get(url, token) {
  return new Promise((resolve, reject) => {
    const isProxy = url.startsWith('http://localhost:3000');
    const path = isProxy ? url.replace('http://localhost:3000', '') : url.replace('http://127.0.0.1:4000', '');
    const host = isProxy ? 'localhost:3000' : '127.0.0.1:4000';
    http.get({ hostname: host.split(':')[0], port: host.split(':')[1], path, headers: token ? { Authorization: `Bearer ${token}` } : {} }, (r) => {
      let b = ''; r.on('data', c => b += c); r.on('end', () => resolve({ status: r.statusCode, body: b.slice(0, 500), len: b.length }));
    }).on('error', reject);
  });
}

async function main() {
  const user = await prisma.user.findFirst({ where: { role: 'athlete' }, select: { id: true, email: true } });
  const token = jwt.sign({ sub: user.id, email: user.email, role: 'athlete' }, JWT);

  const paths = [
    'http://127.0.0.1:4000/api/dashboard/athlete/home',
    'http://127.0.0.1:4000/api/nutrition/kitchen/meals',
    'http://127.0.0.1:4000/api/nutrition/kitchen/foods',
    'http://localhost:3000/api/dashboard/athlete/home',
    'http://localhost:3000/api/nutrition/kitchen/meals',
  ];

  for (const url of paths) {
    try {
      const r = await get(url, token);
      console.log(url, r.status, r.len, r.status >= 400 ? r.body : 'ok');
    } catch (e) {
      console.log(url, 'ERR', e.message);
    }
  }
}

main().finally(() => prisma.$disconnect());
