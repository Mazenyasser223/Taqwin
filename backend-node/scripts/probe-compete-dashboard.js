#!/usr/bin/env node
require('dotenv').config({ override: true });
const { prisma } = require('../src/db');
const { getGamificationDashboard } = require('../src/lib/gamification/gamificationService');

async function main() {
  const emails = process.argv.slice(2).length
    ? process.argv.slice(2)
    : ['ahmedsaid108239@gmail.com', 'compete.seed.24@taqwin.app'];
  for (const email of emails) {
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!u) {
      console.log(email, 'NOT FOUND');
      continue;
    }
    const [s, m] = await Promise.all([
      prisma.userSettings.findUnique({ where: { userId: u.id }, select: { leagueOptIn: true } }),
      prisma.leagueMembership.findMany({
        where: { userId: u.id },
        select: { tier: true, rank: true, seasonId: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      }),
    ]);
    const dash = await getGamificationDashboard(u.id);
    console.log('\n', email);
    console.log('  DB leagueOptIn:', s?.leagueOptIn);
    console.log('  DB membership:', m[0] ?? 'none');
    console.log('  API league:', dash.league);
  }
}

main().finally(() => prisma.$disconnect());
