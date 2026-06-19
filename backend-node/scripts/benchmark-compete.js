#!/usr/bin/env node
/* eslint-disable no-console */
require('dotenv').config({ override: true });
const jwt = require('jsonwebtoken');
const http = require('http');
const { prisma } = require('../src/db');

const PORT = Number(process.env.PORT || 4000);
const JWT = process.env.JWT_SECRET || 'taqwin-dev-secret-change-in-production-min-32-chars';
const EMAIL = (process.env.VERIFY_COMPETE_EMAIL || 'ahmedsaid108239@gmail.com').trim().toLowerCase();

function timed(path, token) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    http.get(`http://127.0.0.1:${PORT}${path}`, { headers: { Authorization: `Bearer ${token}` } }, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => resolve({ ms: Date.now() - start, status: res.statusCode, bytes: b.length }));
    }).on('error', reject);
  });
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true, email: true, role: true } });
  if (!user) throw new Error(`User not found: ${EMAIL}`);
  const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT, { expiresIn: '1h' });
  console.log('Benchmark compete APIs for', EMAIL, '\n');

  const paths = [
    ['league/current light', '/api/gamification/league/current?light=1'],
    ['bootstrap+prefetch', '/api/gamification/league/bootstrap?scope=league&prefetch=friends,gym,global&limit=50'],
    ['bootstrap league only', '/api/gamification/league/bootstrap?scope=league&limit=50'],
    ['leaderboard league', '/api/gamification/league/leaderboard?scope=league&limit=50'],
    ['leaderboard friends', '/api/gamification/league/leaderboard?scope=friends&limit=50'],
    ['leaderboard gym', '/api/gamification/league/leaderboard?scope=gym&limit=50'],
    ['leaderboard global', '/api/gamification/league/leaderboard?scope=global&limit=50'],
    ['social', '/api/gamification/social'],
    ['challenges', '/api/gamification/challenges'],
    ['me', '/api/gamification/me'],
  ];

  for (const [label, path] of paths) {
    const r = await timed(path, token);
    console.log(`${label.padEnd(24)} ${String(r.ms).padStart(5)}ms  ${r.status}  ${r.bytes} bytes`);
  }
}

main().finally(() => prisma.$disconnect());
