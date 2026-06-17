#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Verify league + social compete endpoints (DB + API smoke test).
 *
 * Usage:
 *   npm run verify:compete
 *   VERIFY_COMPETE_EMAIL=you@email.com node scripts/verify-compete.js
 *
 * Requires backend running on PORT (default 4000) and DATABASE_URL.
 */
require('dotenv').config({ override: true });

const http = require('http');
const jwt = require('jsonwebtoken');
const { prisma } = require('../src/db');

const PORT = Number(process.env.PORT || 4000);
const BASE = `http://127.0.0.1:${PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || 'taqwin-dev-secret-change-in-production-min-32-chars';
const VIEWER_EMAIL =
  (process.env.VERIFY_COMPETE_EMAIL || process.env.COMPETE_SEED_VIEWER_EMAIL || 'demo@taqwin.app')
    .trim()
    .toLowerCase();

function request(path, token, { method = 'GET', body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      `${BASE}${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = data ? JSON.parse(data) : null;
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed, raw: data });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function assertOk(label, res, { minStatus = 200, maxStatus = 299 } = {}) {
  if (res.status < minStatus || res.status > maxStatus) {
    const detail =
      typeof res.body === 'object' ? JSON.stringify(res.body).slice(0, 400) : String(res.raw).slice(0, 400);
    throw new Error(`${label}: HTTP ${res.status} — ${detail}`);
  }
  console.log(`  ✓ ${label} (${res.status})`);
  return res.body;
}

async function main() {
  console.log(`[verify-compete] viewer=${VIEWER_EMAIL} api=${BASE}`);

  const user = await prisma.user.findUnique({
    where: { email: VIEWER_EMAIL },
    select: { id: true, email: true, role: true },
  });
  if (!user || user.role !== 'athlete') {
    throw new Error(
      `Athlete not found: ${VIEWER_EMAIL}. Run: npm run db:seed && npm run db:seed:compete -- --viewer=${VIEWER_EMAIL}`,
    );
  }

  const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: '1h',
  });

  const [templates, season, membership] = await Promise.all([
    prisma.challengeTemplate.count({ where: { active: true } }),
    prisma.leagueSeason.findFirst({ where: { status: 'open' }, orderBy: { weekStart: 'desc' } }),
    prisma.leagueMembership.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
  ]);
  console.log(
    `  ✓ DB: ${templates} challenge templates, season=${season?.weekStart ?? 'none'}, membership=${membership ? 'yes' : 'no'}`,
  );

  if (templates < 1) {
    throw new Error('No challenge templates — run: npm run db:seed:challenges');
  }

  const bootstrap = assertOk(
    'GET /league/bootstrap?prefetch=friends,gym,global',
    await request('/api/gamification/league/bootstrap?scope=league&limit=50&prefetch=friends,gym,global', token),
  );

  if (!bootstrap.league?.optedIn) {
    console.log('  ⚠ viewer not opted into league — run compete seed or POST /league/join');
  } else {
    const entryCount = bootstrap.leaderboard?.entries?.length ?? 0;
    console.log(`    league entries: ${entryCount}, tier: ${bootstrap.league.tier}`);
    for (const scope of ['friends', 'gym', 'global']) {
      const pref = bootstrap.prefetchedLeaderboards?.[scope];
      console.log(`    prefetched ${scope}: ${pref?.entries?.length ?? 0} entries`);
    }
  }

  const social = assertOk('GET /social', await request('/api/gamification/social', token));
  console.log(
    `    friends=${social.friends?.length ?? 0}, duels pending=${social.duels?.pending?.length ?? 0}, squads recruiting=${social.squads?.recruiting?.length ?? 0}`,
  );

  const challenges = assertOk('GET /challenges', await request('/api/gamification/challenges', token));
  console.log(
    `    catalog=${challenges.catalog?.length ?? 0}, active=${challenges.active?.length ?? 0}, completed=${challenges.completedCount ?? 0}`,
  );

  for (const scope of ['league', 'friends', 'gym', 'global']) {
    assertOk(
      `GET /league/leaderboard?scope=${scope}`,
      await request(`/api/gamification/league/leaderboard?scope=${scope}&limit=50`, token),
    );
  }

  console.log('\n[verify-compete] All checks passed.');
}

main()
  .catch((err) => {
    console.error('\n[verify-compete] FAILED:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
