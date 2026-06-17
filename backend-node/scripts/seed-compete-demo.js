#!/usr/bin/env node
/**
 * Gamification demo seed — league pods, solo challenges, duels, squads.
 *
 * Run:
 *   npm run db:seed:compete
 *   npm run db:seed:compete:force
 *   node scripts/seed-compete-demo.js --viewer=you@email.com
 *
 * Defaults viewer to demo@taqwin.app (or COMPETE_SEED_VIEWER_EMAIL).
 */
require('dotenv').config({ override: true });
const { createHash, randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient, Role } = require('../generated/prisma');
const { CHALLENGE_TEMPLATES } = require('../src/lib/gamification/challengeConfig');
const { MIN_DAYS_TO_RANK } = require('../src/lib/gamification/leagueConfig');
const { addCalendarDays } = require('../src/lib/plans/planCalendar');
const { weekStartSundayUtc } = require('../src/lib/plans/planWeek');

const prisma = new PrismaClient();
const PASSWORD = 'Taqwin#2025';
const SEED_EMAIL_PREFIX = 'compete.seed.';
const META_KEY = 'compete_demo_seeded_v1';

const META_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS _meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

/** Deterministic UUID v4-like ids for idempotent upserts. */
function seedId(label) {
  const h = createHash('sha256').update(`taqwin-compete-seed:v2:${label}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const viewerArg = args.find((a) => a.startsWith('--viewer='));
  const viewerEmail =
    viewerArg?.split('=')[1]?.trim() ||
    process.env.COMPETE_SEED_VIEWER_EMAIL ||
    'demo@taqwin.app';
  return { force, viewerEmail };
}

function getLeagueWeekBounds(now = new Date()) {
  const start = weekStartSundayUtc(now);
  const dateKeys = [];
  for (let i = 0; i < 7; i += 1) {
    dateKeys.push(addCalendarDays(start, i).toISOString().slice(0, 10));
  }
  return { weekStart: dateKeys[0], weekEnd: dateKeys[6], dateKeys };
}

function dateRangeFromToday(durationDays, timezone = 'UTC') {
  const start = new Date();
  const startDateKey = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(start);
  const endDateKey = addCalendarDays(new Date(`${startDateKey}T12:00:00.000Z`), durationDays - 1)
    .toISOString()
    .slice(0, 10);
  return { startDateKey, endDateKey };
}

function scoreParts(total) {
  const q = total / 4;
  return {
    score: total,
    sleepPts: q,
    mealsPts: q,
    waterPts: q,
    workoutPts: q,
  };
}

function computeWeeklyFromScores(rows) {
  const scored = rows.filter((r) => r.score > 0);
  const daysCounted = scored.length;
  if (!daysCounted) return { weeklyAvg: null, daysCounted: 0, qualified: false };
  const weeklyAvg = Math.round(scored.reduce((s, r) => s + r.score, 0) / daysCounted);
  return { weeklyAvg, daysCounted, qualified: daysCounted >= MIN_DAYS_TO_RANK };
}

const SEED_ATHLETES = [
  { key: '01', displayName: 'Sara Nabil', tier: 'bronze', handle: 'saranabil', daysScored: 5, scoreBase: 78 },
  { key: '02', displayName: 'Omar Hadi', tier: 'bronze', handle: 'omarhadi', daysScored: 4, scoreBase: 71 },
  { key: '03', displayName: 'Lina Farouk', tier: 'bronze', handle: 'linaf', daysScored: 6, scoreBase: 85 },
  { key: '04', displayName: 'Youssef Ali', tier: 'bronze', handle: 'youssef_lifts', daysScored: 3, scoreBase: 62 },
  { key: '05', displayName: 'Nour Essam', tier: 'bronze', handle: 'nouressam', daysScored: 5, scoreBase: 74 },
  { key: '06', displayName: 'Hassan Kareem', tier: 'bronze', handle: 'hkareem', daysScored: 4, scoreBase: 68 },
  { key: '07', displayName: 'Mariam Soliman', tier: 'bronze', handle: 'mariams', daysScored: 3, scoreBase: 59 },
  { key: '08', displayName: 'Tarek Mansour', tier: 'bronze', handle: 'tarekm', daysScored: 5, scoreBase: 81 },
  { key: '09', displayName: 'Dina Ashraf', tier: 'bronze', handle: 'dinaa', daysScored: 6, scoreBase: 88 },
  { key: '10', displayName: 'Khaled Samir', tier: 'bronze', handle: 'khaleds', daysScored: 4, scoreBase: 66 },
  { key: '11', displayName: 'Iman Mahrous', tier: 'bronze', handle: 'imahrous13', daysScored: 5, scoreBase: 76 },
  { key: '12', displayName: 'Ramy Fouda', tier: 'silver', handle: 'ramyf', daysScored: 6, scoreBase: 91 },
  { key: '13', displayName: 'Salma Adel', tier: 'silver', handle: 'salmaadel', daysScored: 5, scoreBase: 84 },
  { key: '14', displayName: 'Ziad Nasser', tier: 'silver', handle: 'ziadn', daysScored: 4, scoreBase: 79 },
  { key: '15', displayName: 'Hana Mostafa', tier: 'silver', handle: 'hanam', daysScored: 6, scoreBase: 93 },
  { key: '16', displayName: 'Amir Lotfy', tier: 'silver', handle: 'amirl', daysScored: 3, scoreBase: 70 },
  { key: '17', displayName: 'Nada Sherif', tier: 'gold', handle: 'nadas', daysScored: 5, scoreBase: 86 },
  { key: '18', displayName: 'Bassem Orabi', tier: 'gold', handle: 'bassemo', daysScored: 6, scoreBase: 94 },
  { key: '19', displayName: 'Farah Emad', tier: 'gold', handle: 'farah_e', daysScored: 4, scoreBase: 82 },
  { key: '20', displayName: 'Mahmoud Rizk', tier: 'diamond', handle: 'mahmoudr', daysScored: 6, scoreBase: 96 },
  { key: '21', displayName: 'Yasmin Hafez', tier: 'diamond', handle: 'yasminh', daysScored: 5, scoreBase: 92 },
  { key: '22', displayName: 'Peter Naguib', tier: 'silver', handle: 'petern', daysScored: 5, scoreBase: 80 },
  { key: '23', displayName: 'Reem Galal', tier: 'gold', handle: 'reemg', daysScored: 3, scoreBase: 73 },
  { key: '24', displayName: 'Adel Fares', tier: 'bronze', handle: 'adelf', daysScored: 5, scoreBase: 77 },
];

async function isSeeded(force) {
  await prisma.$executeRawUnsafe(META_TABLE_SQL);
  if (force) return false;
  const rows = await prisma.$queryRawUnsafe('SELECT value FROM _meta WHERE key = $1 LIMIT 1', META_KEY);
  return Array.isArray(rows) && rows.length > 0;
}

async function markSeeded() {
  await prisma.$executeRawUnsafe(
    `INSERT INTO _meta (key, value) VALUES ($1, NOW()::text)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();`,
    META_KEY,
  );
}

async function wipeSeedUsers() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: SEED_EMAIL_PREFIX } },
    select: { id: true },
  });
  if (!users.length) return;
  console.log(`[compete-seed] removing ${users.length} previous seed athletes...`);
  await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
}

async function upsertTemplates() {
  for (const template of CHALLENGE_TEMPLATES) {
    await prisma.challengeTemplate.upsert({
      where: { slug: template.slug },
      create: { ...template, active: true },
      update: {
        durationDays: template.durationDays,
        metric: template.metric,
        target: template.target,
        xpReward: template.xpReward,
        badgeSlug: template.badgeSlug,
        icon: template.icon,
        sortOrder: template.sortOrder,
        active: true,
      },
    });
  }
}

async function upsertSeedAthlete(def, passwordHash) {
  const email = `${SEED_EMAIL_PREFIX}${def.key}@taqwin.app`;
  const user = await prisma.user.upsert({
    where: { email },
    update: { role: Role.athlete },
    create: {
      id: seedId(`user-${def.key}`),
      email,
      role: Role.athlete,
      passwordHash,
      emailVerifiedAt: new Date(),
      athleteProfile: {
        create: {
          displayName: def.displayName,
          fitnessGoal: 'General Fitness',
          fitnessLevel: 'Intermediate',
        },
      },
    },
    include: { athleteProfile: true },
  });

  if (user.athleteProfile) {
    await prisma.athleteProfile.update({
      where: { userId: user.id },
      data: { displayName: def.displayName },
    });
  }

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {
      leagueOptIn: true,
      showOnLeaderboard: true,
      leaderboardVisibility: 'global',
      publicProfile: true,
    },
    create: {
      userId: user.id,
      leagueOptIn: true,
      showOnLeaderboard: true,
      leaderboardVisibility: 'global',
      publicProfile: true,
    },
  });

  await prisma.userGamification.upsert({
    where: { userId: user.id },
    update: { currentTier: def.tier, lifetimeXp: 420, currentXp: 120 },
    create: {
      userId: user.id,
      currentTier: def.tier,
      lifetimeXp: 420,
      currentXp: 120,
    },
  });

  return { ...def, userId: user.id, email };
}

async function ensureMutualFollow(aId, bId) {
  await prisma.communityFollow.upsert({
    where: { followerId_followingId: { followerId: aId, followingId: bId } },
    update: { status: 'accepted' },
    create: { id: randomUUID(), followerId: aId, followingId: bId, status: 'accepted' },
  });
  await prisma.communityFollow.upsert({
    where: { followerId_followingId: { followerId: bId, followingId: aId } },
    update: { status: 'accepted' },
    create: { id: randomUUID(), followerId: bId, followingId: aId, status: 'accepted' },
  });
}

async function seedDailyScores(userId, dateKeys, daysScored, scoreBase) {
  const rows = [];
  const todayKey = new Date().toISOString().slice(0, 10);
  let scored = 0;
  for (const dateKey of dateKeys) {
    if (dateKey > todayKey) continue;
    if (scored >= daysScored) continue;
    const variance = (scored % 3) * 4 - 4;
    const total = Math.max(35, Math.min(100, scoreBase + variance));
    const parts = scoreParts(total);
    await prisma.athleteDailyScore.upsert({
      where: { userId_dateKey: { userId, dateKey } },
      create: { id: randomUUID(), userId, dateKey, ...parts, source: 'seed' },
      update: { ...parts, source: 'seed' },
    });
    rows.push({ score: total });
    scored += 1;
  }
  return rows;
}

async function upsertLeagueMembership(userId, seasonId, tier, stats, rank) {
  await prisma.leagueMembership.upsert({
    where: { userId_seasonId: { userId, seasonId } },
    create: {
      id: seedId(`membership-${userId.slice(0, 8)}-${seasonId.slice(0, 8)}`),
      userId,
      seasonId,
      tier,
      weeklyAvg: stats.weeklyAvg,
      daysCounted: stats.daysCounted,
      rank: stats.qualified ? rank : null,
    },
    update: {
      tier,
      weeklyAvg: stats.weeklyAvg,
      daysCounted: stats.daysCounted,
      rank: stats.qualified ? rank : null,
    },
  });
}

async function upsertSoloParticipant({
  id,
  userId,
  templateSlug,
  status,
  progress,
  target,
  startDateKey,
  endDateKey,
}) {
  await prisma.challengeParticipant.upsert({
    where: { id },
    create: {
      id,
      userId,
      templateSlug,
      mode: 'solo',
      startDateKey,
      endDateKey,
      progress,
      target,
      status,
      ...(status === 'completed' ? { completedAt: new Date(), xpAwarded: 80 } : {}),
    },
    update: { progress, target, status, startDateKey, endDateKey },
  });
}

async function upsertDuel({
  id,
  templateSlug,
  challengerId,
  opponentId,
  status,
  target,
  startDateKey,
  endDateKey,
  challengerProgress,
  opponentProgress,
}) {
  const challengerPartId = seedId(`${id}-challenger-part`);
  const opponentPartId = seedId(`${id}-opponent-part`);

  await prisma.challengeDuel.upsert({
    where: { id },
    create: {
      id,
      templateSlug,
      challengerId,
      opponentId,
      status,
      target,
      startDateKey: startDateKey ?? null,
      endDateKey: endDateKey ?? null,
      challengerParticipantId: null,
      opponentParticipantId: null,
    },
    update: {
      status,
      target,
      startDateKey: startDateKey ?? null,
      endDateKey: endDateKey ?? null,
    },
  });

  if (status === 'active') {
    await prisma.challengeParticipant.upsert({
      where: { id: challengerPartId },
      create: {
        id: challengerPartId,
        userId: challengerId,
        templateSlug,
        mode: 'duel',
        duelId: id,
        startDateKey,
        endDateKey,
        progress: challengerProgress,
        target,
        status: 'active',
      },
      update: {
        mode: 'duel',
        duelId: id,
        progress: challengerProgress,
        target,
        status: 'active',
        startDateKey,
        endDateKey,
      },
    });

    await prisma.challengeParticipant.upsert({
      where: { id: opponentPartId },
      create: {
        id: opponentPartId,
        userId: opponentId,
        templateSlug,
        mode: 'duel',
        duelId: id,
        startDateKey,
        endDateKey,
        progress: opponentProgress,
        target,
        status: 'active',
      },
      update: {
        mode: 'duel',
        duelId: id,
        progress: opponentProgress,
        target,
        status: 'active',
        startDateKey,
        endDateKey,
      },
    });

    await prisma.challengeDuel.update({
      where: { id },
      data: {
        challengerParticipantId: challengerPartId,
        opponentParticipantId: opponentPartId,
      },
    });
  } else {
    await prisma.challengeDuel.update({
      where: { id },
      data: { challengerParticipantId: null, opponentParticipantId: null },
    });
  }
}

async function upsertSquad({
  id,
  templateSlug,
  ownerId,
  name,
  status,
  memberIds,
  target,
  startDateKey,
  endDateKey,
  progressByUser,
}) {
  const template = CHALLENGE_TEMPLATES.find((t) => t.slug === templateSlug);

  await prisma.challengeSquad.upsert({
    where: { id },
    create: {
      id,
      templateSlug,
      ownerId,
      name,
      status,
      maxMembers: 5,
      target,
      startDateKey: startDateKey ?? null,
      endDateKey: endDateKey ?? null,
    },
    update: { name, status, target, startDateKey: startDateKey ?? null, endDateKey: endDateKey ?? null },
  });

  for (const userId of memberIds) {
    const memberId = seedId(`${id}-member-${userId.slice(0, 8)}`);
    await prisma.challengeSquadMember.upsert({
      where: { squadId_userId: { squadId: id, userId } },
      create: {
        id: memberId,
        squadId: id,
        userId,
        role: userId === ownerId ? 'owner' : 'member',
      },
      update: { role: userId === ownerId ? 'owner' : 'member' },
    });

    if (status === 'active') {
      const partId = seedId(`${id}-part-${userId.slice(0, 8)}`);
      const progress = progressByUser?.[userId] ?? 0;
      await prisma.challengeParticipant.upsert({
        where: { id: partId },
        create: {
          id: partId,
          userId,
          templateSlug,
          mode: 'squad',
          squadId: id,
          startDateKey,
          endDateKey,
          progress,
          target: target ?? template?.target ?? 4,
          status: 'active',
        },
        update: {
          mode: 'squad',
          squadId: id,
          progress,
          target: target ?? template?.target ?? 4,
          status: 'active',
          startDateKey,
          endDateKey,
        },
      });
    }
  }
}

async function main() {
  const { force, viewerEmail } = parseArgs();
  if (await isSeeded(force)) {
    console.log('[compete-seed] already seeded — use --force to rebuild');
    return;
  }

  console.log(`[compete-seed] seeding compete demo (viewer: ${viewerEmail})...`);
  if (force) {
    await wipeSeedUsers();
    await prisma.$executeRawUnsafe('DELETE FROM _meta WHERE key = $1', META_KEY);
  }

  await upsertTemplates();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const viewer = await prisma.user.findUnique({
    where: { email: viewerEmail },
    include: { athleteProfile: true },
  });
  if (!viewer || viewer.role !== Role.athlete) {
    throw new Error(
      `Viewer athlete not found: ${viewerEmail}. Run db:seed first or pass --viewer=your@email.com`,
    );
  }

  await prisma.userSettings.upsert({
    where: { userId: viewer.id },
    update: {
      leagueOptIn: true,
      showOnLeaderboard: true,
      leaderboardVisibility: 'global',
      challengeNotifications: true,
    },
    create: {
      userId: viewer.id,
      leagueOptIn: true,
      showOnLeaderboard: true,
      leaderboardVisibility: 'global',
      challengeNotifications: true,
    },
  });

  await prisma.userGamification.upsert({
    where: { userId: viewer.id },
    update: { currentTier: 'bronze', lifetimeXp: 350, currentXp: 90 },
    create: { userId: viewer.id, currentTier: 'bronze', lifetimeXp: 350, currentXp: 90 },
  });

  const athletes = [];
  for (const def of SEED_ATHLETES) {
    athletes.push(await upsertSeedAthlete(def, passwordHash));
  }

  for (const a of athletes) {
    await ensureMutualFollow(viewer.id, a.userId);
  }

  const gym = await prisma.gym.findFirst({ orderBy: { createdAt: 'asc' } });
  if (gym) {
    const memberIds = [viewer.id, ...athletes.map((a) => a.userId)];
    for (const userId of memberIds) {
      await prisma.gymMembership.upsert({
        where: { gymId_userId: { gymId: gym.id, userId } },
        update: { isActive: true },
        create: { id: randomUUID(), gymId: gym.id, userId, isActive: true },
      });
    }
    console.log(`[compete-seed] gym memberships → ${gym.name} (${memberIds.length} athletes)`);
  }

  const { weekStart, weekEnd, dateKeys } = getLeagueWeekBounds();
  const season = await prisma.leagueSeason.upsert({
    where: { weekStart },
    create: { id: seedId(`season-${weekStart}`), weekStart, weekEnd, status: 'open' },
    update: { weekEnd, status: 'open', closedAt: null },
  });

  const viewerScoreRows = await seedDailyScores(viewer.id, dateKeys, 3, 17);
  const viewerStats = computeWeeklyFromScores(viewerScoreRows);

  const tierBuckets = new Map();
  for (const tier of ['bronze', 'silver', 'gold', 'diamond']) tierBuckets.set(tier, []);

  for (const a of athletes) {
    const rows = await seedDailyScores(a.userId, dateKeys, a.daysScored, a.scoreBase);
    const stats = computeWeeklyFromScores(rows);
    tierBuckets.get(a.tier).push({ userId: a.userId, tier: a.tier, stats });
  }

  tierBuckets.get('bronze').push({ userId: viewer.id, tier: 'bronze', stats: viewerStats });

  for (const [tier, members] of tierBuckets) {
    const ranked = members
      .filter((m) => m.stats.qualified)
      .sort((a, b) => {
        if ((b.stats.weeklyAvg ?? 0) !== (a.stats.weeklyAvg ?? 0)) {
          return (b.stats.weeklyAvg ?? 0) - (a.stats.weeklyAvg ?? 0);
        }
        return b.stats.daysCounted - a.stats.daysCounted;
      });

    let rank = 1;
    for (const m of ranked) {
      await upsertLeagueMembership(m.userId, season.id, tier, m.stats, rank);
      rank += 1;
    }
    for (const m of members.filter((x) => !x.stats.qualified)) {
      await upsertLeagueMembership(m.userId, season.id, tier, m.stats, null);
    }
  }

  const workoutRange = dateRangeFromToday(7);
  const hydrationRange = dateRangeFromToday(7);

  await upsertSoloParticipant({
    id: seedId('viewer-solo-active'),
    userId: viewer.id,
    templateSlug: 'workout-7',
    status: 'active',
    progress: 2,
    target: 4,
    ...workoutRange,
  });

  await upsertSoloParticipant({
    id: seedId('viewer-solo-completed'),
    userId: viewer.id,
    templateSlug: 'hydration-7',
    status: 'completed',
    progress: 5,
    target: 5,
    ...hydrationRange,
  });

  await upsertSoloParticipant({
    id: seedId('viewer-solo-failed'),
    userId: viewer.id,
    templateSlug: 'score-7',
    status: 'failed',
    progress: 1,
    target: 5,
    ...workoutRange,
  });

  for (const [i, a] of athletes.slice(0, 8).entries()) {
    const tpl = CHALLENGE_TEMPLATES[i % CHALLENGE_TEMPLATES.length];
    const range = dateRangeFromToday(tpl.durationDays);
    await upsertSoloParticipant({
      id: seedId(`seed-solo-${a.key}`),
      userId: a.userId,
      templateSlug: tpl.slug,
      status: i % 3 === 0 ? 'completed' : 'active',
      progress: Math.min(tpl.target, 1 + (i % tpl.target)),
      target: tpl.target,
      ...range,
    });
  }

  const friendA = athletes.find((a) => a.key === '11') ?? athletes[0];
  const friendB = athletes.find((a) => a.key === '01') ?? athletes[1];
  const friendC = athletes.find((a) => a.key === '03') ?? athletes[2];

  await upsertDuel({
    id: seedId('duel-pending-in'),
    templateSlug: 'workout-7',
    challengerId: friendA.userId,
    opponentId: viewer.id,
    status: 'pending',
    target: 4,
  });

  await upsertDuel({
    id: seedId('duel-pending-out'),
    templateSlug: 'streak-7',
    challengerId: viewer.id,
    opponentId: friendB.userId,
    status: 'pending',
    target: 5,
  });

  await upsertDuel({
    id: seedId('duel-active'),
    templateSlug: 'hydration-7',
    challengerId: viewer.id,
    opponentId: friendA.userId,
    status: 'active',
    target: 5,
    ...hydrationRange,
    challengerProgress: 3,
    opponentProgress: 2,
  });

  await upsertDuel({
    id: seedId('duel-active-seed'),
    templateSlug: 'workout-7',
    challengerId: friendB.userId,
    opponentId: friendC.userId,
    status: 'active',
    target: 4,
    ...workoutRange,
    challengerProgress: 2,
    opponentProgress: 3,
  });

  await upsertSquad({
    id: seedId('squad-recruiting-viewer'),
    templateSlug: 'workout-7',
    ownerId: viewer.id,
    name: 'Weekend Warriors',
    status: 'recruiting',
    memberIds: [viewer.id],
    target: 4,
  });

  await upsertSquad({
    id: seedId('squad-recruiting-open'),
    templateSlug: 'hydration-7',
    ownerId: friendC.userId,
    name: 'Hydration Crew',
    status: 'recruiting',
    memberIds: [friendC.userId, friendB.userId],
    target: 5,
  });

  await upsertSquad({
    id: seedId('squad-active-viewer'),
    templateSlug: 'workout-7',
    ownerId: friendA.userId,
    name: 'Iron Consistency',
    status: 'active',
    memberIds: [friendA.userId, viewer.id, athletes[4].userId],
    target: 4,
    ...workoutRange,
    progressByUser: {
      [friendA.userId]: 3,
      [viewer.id]: 2,
      [athletes[4].userId]: 2,
    },
  });

  await prisma.userAchievement.upsert({
    where: { userId_slug: { userId: viewer.id, slug: 'league_first_week' } },
    create: { id: randomUUID(), userId: viewer.id, slug: 'league_first_week' },
    update: {},
  });

  await markSeeded();

  console.log('[compete-seed] done');
  console.log(`  • ${athletes.length} seed athletes (${SEED_EMAIL_PREFIX}*@taqwin.app)`);
  console.log(`  • League season ${weekStart} → ${weekEnd} with pods across 4 tiers`);
  console.log(`  • Viewer ${viewerEmail}: solo challenges, duels, squads, league rank`);
  console.log(`  • ${athletes.length} mutual friends for social tab`);
  if (gym) console.log(`  • Gym leaderboard: ${gym.name}`);
  console.log('  • Re-run: npm run db:seed:compete:force');
  console.log('  • Custom viewer: node scripts/seed-compete-demo.js --viewer=you@email.com --force');
}

main()
  .catch((err) => {
    console.error('[compete-seed] failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
