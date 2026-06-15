const jwt = require('jsonwebtoken');
const http = require('http');
const { prisma } = require('../src/db');

const JWT = process.env.JWT_SECRET || 'taqwin-dev-secret-change-in-production-min-32-chars';
const USER_ID = 'd846da85-bc71-4d08-a888-f38aeaa4e8c7';

async function main() {
  const user = await prisma.user.findUnique({ where: { id: USER_ID }, select: { id: true, email: true } });
  if (!user) {
    console.log('user not found');
    return;
  }
  const token = jwt.sign({ sub: user.id, email: user.email, role: 'athlete' }, JWT);
  const start = Date.now();
  const r = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:4000/api/dashboard/athlete/home', { headers: { Authorization: `Bearer ${token}` } }, (res) => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => resolve({ status: res.statusCode, body: b }));
    }).on('error', reject);
  });
  console.log('status', r.status, 'ms', Date.now() - start, 'bytes', r.body.length);
  if (r.status >= 400) console.log(r.body.slice(0, 800));
}

main().finally(() => prisma.$disconnect());
