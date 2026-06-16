/**
 * Taqwin Score League — seasons, memberships, leaderboards, weekly close.
 */
const { randomUUID } = require('crypto');
const { prisma } = require('../../db');
const { addCalendarDays } = require('../plans/planCalendar');
const { weekStartSundayUtc } = require('../plans/planWeek');
const { getOrCreateUserSettings } = require('../userSettings');
const {
  TIERS,
  MIN_DAYS_TO_RANK,
  PROMOTE_FRACTION,
  DEMOTE_FRACTION,
  XP_PROMOTED,
  XP_TOP10_IN_TIER,
  ACHIEVEMENTS,
  promoteTier,
  demoteTier,
} = require('./leagueConfig');
const { awardAchievement, awardXp } = require('./rewards');
const { emitGamificationNotification } = require('./gamificationNotify');
const {
  getCachedPodStats,
  setCachedPodStats,
  invalidateWeekLeaderboardCache,
} = require('./leagueLeaderboardCache');

async function getOrCreateUserGamificationLocal(userId) {
  let row = await prisma.userGamification.findUnique({ where: { userId } });
  if (!row) {
    row = await prisma.userGamification.create({ data: { userId } });
  }
  return row;
}

function getLeagueWeekBounds(now = new Date()) {
  const start = weekStartSundayUtc(now);
  const dateKeys = [];
  for (let i = 0; i < 7; i += 1) {
    dateKeys.push(addCalendarDays(start, i).toISOString().slice(0, 10));
  }
  return {
    weekStart: dateKeys[0],
    weekEnd: dateKeys[6],
    dateKeys,
  };
}

async function ensureOpenSeason(now = new Date()) {
  const { weekStart, weekEnd } = getLeagueWeekBounds(now);
  let season = await prisma.leagueSeason.findUnique({ where: { weekStart } });
  if (!season) {
    season = await prisma.leagueSeason.create({
      data: { id: randomUUID(), weekStart, weekEnd, status: 'open' },
    });
  }
  return season;
}

async function computeWeeklyStats(userId, dateKeys) {
  const rows = await prisma.athleteDailyScore.findMany({
    where: { userId, dateKey: { in: dateKeys } },
    select: { dateKey: true, score: true },
  });
  const scored = rows.filter((r) => r.score > 0);
  const daysCounted = scored.length;
  if (daysCounted === 0) {
    return { weeklyAvg: null, daysCounted: 0, qualified: false };
  }
  const weeklyAvg = Math.round(scored.reduce((s, r) => s + r.score, 0) / daysCounted);
  return {
    weeklyAvg,
    daysCounted,
    qualified: daysCounted >= MIN_DAYS_TO_RANK,
  };
}

async function resolvePodStatsMap(userIds, dateKeys, weekStart, tier) {
  if (!tier || userIds.length === 0) {
    const map = new Map();
    for (const uid of userIds) {
      map.set(uid, await computeWeeklyStats(uid, dateKeys));
    }
    return map;
  }

  const cached = await getCachedPodStats(weekStart, tier);
  const map = new Map();
  const missing = [];

  for (const uid of userIds) {
    const hit = cached?.[uid];
    if (hit) map.set(uid, hit);
    else missing.push(uid);
  }

  for (const uid of missing) {
    map.set(uid, await computeWeeklyStats(uid, dateKeys));
  }

  if (missing.length > 0 || !cached) {
    await setCachedPodStats(weekStart, tier, Object.fromEntries(map));
  }

  return map;
}

async function ensureLeagueMembership(userId, seasonId = null) {
  const settings = await getOrCreateUserSettings(userId);
  if (!settings.leagueOptIn) return null;

  const gamification = await getOrCreateUserGamificationLocal(userId);
  const season = seasonId
    ? await prisma.leagueSeason.findUnique({ where: { id: seasonId } })
    : await ensureOpenSeason();
  if (!season || season.status !== 'open') return null;

  const existing = await prisma.leagueMembership.findUnique({
    where: { userId_seasonId: { userId, seasonId: season.id } },
  });
  if (existing) return existing;

  const membership = await prisma.leagueMembership.create({
    data: {
      id: randomUUID(),
      userId,
      seasonId: season.id,
      tier: gamification.currentTier || 'bronze',
    },
  });

  await awardAchievement(userId, ACHIEVEMENTS.league_first_week.slug);
  return membership;
}

function displayNameForUser(user, showName) {
  if (!showName) return null;
  const profile = user.athleteProfile;
  return (
    profile?.displayName ||
    user.email?.split('@')[0] ||
    'Athlete'
  );
}

function avatarForUser(user) {
  return user.athleteProfile?.communityAvatarUrl || user.athleteProfile?.avatarUrl || null;
}

async function loadLeaderboardCandidates(seasonId, tier, viewerId, scope) {
  const where = {
    seasonId,
    user: { settings: { leagueOptIn: true } },
  };
  if (tier) where.tier = tier;

  if (scope === 'friends') {
    const follows = await prisma.communityFollow.findMany({
      where: {
        OR: [{ followerId: viewerId }, { followingId: viewerId }],
      },
      select: { followerId: true, followingId: true },
    });
    const friendIds = new Set([viewerId]);
    for (const f of follows) {
      friendIds.add(f.followerId);
      friendIds.add(f.followingId);
    }
    where.userId = { in: [...friendIds] };
  } else if (scope === 'gym') {
    const membership = await prisma.gymMembership.findFirst({
      where: { userId: viewerId, isActive: true },
      select: { gymId: true },
    });
    if (!membership) return [];
    const gymMembers = await prisma.gymMembership.findMany({
      where: { gymId: membership.gymId, isActive: true },
      select: { userId: true },
    });
    where.userId = { in: gymMembers.map((m) => m.userId) };
  } else if (scope === 'global') {
    // All opted-in members; names gated per-user below
  }

  const rows = await prisma.leagueMembership.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          athleteProfile: {
            select: { displayName: true, communityAvatarUrl: true, avatarUrl: true },
          },
          settings: { select: { showOnLeaderboard: true } },
        },
      },
    },
  });

  return rows;
}

async function buildLeaderboardEntries(season, tier, viewerId, scope, limit = 50) {
  const { dateKeys } = getLeagueWeekBounds(new Date(`${season.weekStart}T12:00:00.000Z`));
  const candidates = await loadLeaderboardCandidates(season.id, tier, viewerId, scope);
  const userIds = candidates.map((row) => row.userId);
  const statsMap = await resolvePodStatsMap(userIds, dateKeys, season.weekStart, tier);

  const enriched = [];
  for (const row of candidates) {
    const stats = statsMap.get(row.userId) || {
      weeklyAvg: null,
      daysCounted: 0,
      qualified: false,
    };
    if (!stats.qualified && row.userId !== viewerId) continue;

    const showName =
      row.userId === viewerId ||
      (scope === 'global'
        ? row.user.settings?.showOnLeaderboard === true ||
          row.user.settings?.leaderboardVisibility === 'global'
        : row.user.settings?.showOnLeaderboard !== false);
    enriched.push({
      userId: row.userId,
      displayName: displayNameForUser(row.user, showName) || (showName ? 'Athlete' : null),
      anonymous: !showName && row.userId !== viewerId,
      avatarUrl: showName ? avatarForUser(row.user) : null,
      weeklyAvg: stats.weeklyAvg,
      daysCounted: stats.daysCounted,
      tier: row.tier,
      isSelf: row.userId === viewerId,
      qualified: stats.qualified,
    });
  }

  enriched.sort((a, b) => {
    const avgA = a.weeklyAvg ?? -1;
    const avgB = b.weeklyAvg ?? -1;
    if (avgB !== avgA) return avgB - avgA;
    return (b.daysCounted ?? 0) - (a.daysCounted ?? 0);
  });

  const ranked = enriched.map((entry, idx) => ({
    ...entry,
    rank: entry.weeklyAvg != null ? idx + 1 : null,
  }));

  return ranked.slice(0, limit);
}

async function computePodRank(userId, seasonId, tier) {
  const { dateKeys, weekStart } = getLeagueWeekBounds();
  const members = await prisma.leagueMembership.findMany({
    where: { seasonId, tier },
    select: { userId: true },
  });
  if (!members.length) return null;

  const userIds = members.map((m) => m.userId);
  const statsMap = await resolvePodStatsMap(userIds, dateKeys, weekStart, tier);

  const ranked = userIds
    .map((uid) => ({ userId: uid, ...(statsMap.get(uid) || { qualified: false, weeklyAvg: null, daysCounted: 0 }) }))
    .filter((row) => row.qualified)
    .sort((a, b) => {
      const avgB = b.weeklyAvg ?? -1;
      const avgA = a.weeklyAvg ?? -1;
      if (avgB !== avgA) return avgB - avgA;
      return (b.daysCounted ?? 0) - (a.daysCounted ?? 0);
    });

  const idx = ranked.findIndex((row) => row.userId === userId);
  return idx >= 0 ? idx + 1 : null;
}

async function getCurrentLeagueStatus(userId) {
  const settings = await getOrCreateUserSettings(userId);
  if (!settings.leagueOptIn) {
    return { optedIn: false };
  }

  const gamification = await getOrCreateUserGamificationLocal(userId);
  const season = await ensureOpenSeason();
  const membership = await ensureLeagueMembership(userId, season.id);
  const { dateKeys } = getLeagueWeekBounds();
  const stats = await computeWeeklyStats(userId, dateKeys);

  let rank = null;
  if (membership && stats.qualified) {
    rank = await computePodRank(userId, season.id, membership.tier);
  }

  if (membership && stats.weeklyAvg != null) {
    await prisma.leagueMembership.update({
      where: { id: membership.id },
      data: {
        weeklyAvg: stats.weeklyAvg,
        daysCounted: stats.daysCounted,
        rank,
      },
    });
  }

  const achievements = await prisma.userAchievement.findMany({
    where: { userId, slug: { in: Object.keys(ACHIEVEMENTS) } },
    select: { slug: true, earnedAt: true },
  });

  return {
    optedIn: true,
    season: {
      id: season.id,
      weekStart: season.weekStart,
      weekEnd: season.weekEnd,
      status: season.status,
    },
    tier: membership?.tier ?? gamification.currentTier,
    weeklyAvg: stats.weeklyAvg,
    daysCounted: stats.daysCounted,
    daysRequired: MIN_DAYS_TO_RANK,
    rank,
    podSize: membership
      ? (
          await prisma.leagueMembership.count({
            where: { seasonId: season.id, tier: membership.tier },
          })
        )
      : 0,
    achievements,
  };
}

async function getLeaderboard(userId, scope = 'league', limit = 50) {
  const settings = await getOrCreateUserSettings(userId);
  if (!settings.leagueOptIn) {
    const err = new Error('League opt-in required');
    err.status = 403;
    throw err;
  }

  const validScopes = new Set(['league', 'friends', 'gym', 'global']);
  if (!validScopes.has(scope)) {
    const err = new Error('Invalid scope');
    err.status = 400;
    throw err;
  }

  const season = await ensureOpenSeason();
  const membership = await ensureLeagueMembership(userId, season.id);
  const tierFilter = scope === 'global' ? null : membership?.tier ?? 'bronze';

  const entries = await buildLeaderboardEntries(season, tierFilter, userId, scope, limit);

  return {
    scope,
    tier: scope === 'league' ? tierFilter : null,
    season: {
      weekStart: season.weekStart,
      weekEnd: season.weekEnd,
    },
    entries,
  };
}

function promotionCutoffs(count) {
  if (count < 2) return { promote: 0, demote: 0 };
  const promote = Math.max(1, Math.floor(count * PROMOTE_FRACTION));
  const demote = Math.max(1, Math.floor(count * DEMOTE_FRACTION));
  return { promote, demote };
}

async function closeSeason(seasonId, { dryRun = false } = {}) {
  const season = await prisma.leagueSeason.findUnique({ where: { id: seasonId } });
  if (!season || season.status !== 'open') {
    return { ok: false, reason: 'season_not_open' };
  }

  const { dateKeys } = getLeagueWeekBounds(new Date(`${season.weekStart}T12:00:00.000Z`));
  const memberships = await prisma.leagueMembership.findMany({ where: { seasonId } });
  let processed = 0;

  for (const tier of TIERS) {
    const pod = memberships.filter((m) => m.tier === tier);
    const ranked = [];

    for (const m of pod) {
      const stats = await computeWeeklyStats(m.userId, dateKeys);
      if (!stats.qualified) continue;
      ranked.push({ ...m, weeklyAvg: stats.weeklyAvg, daysCounted: stats.daysCounted });
    }

    ranked.sort((a, b) => {
      if (b.weeklyAvg !== a.weeklyAvg) return b.weeklyAvg - a.weeklyAvg;
      return b.daysCounted - a.daysCounted;
    });

    const { promote, demote } = promotionCutoffs(ranked.length);

    for (let i = 0; i < ranked.length; i += 1) {
      const row = ranked[i];
      const rank = i + 1;
      let promoted = false;
      let demoted = false;
      let xp = 0;
      let newTier = tier;

      if (rank <= promote && tier !== 'diamond') {
        promoted = true;
        newTier = promoteTier(tier);
        xp += XP_PROMOTED;
      } else if (rank > ranked.length - demote && tier !== 'bronze' && ranked.length >= 3) {
        demoted = true;
        newTier = demoteTier(tier);
      }

      if (rank <= 10) {
        xp += XP_TOP10_IN_TIER;
      }

      if (!dryRun) {
        await prisma.leagueMembership.update({
          where: { id: row.id },
          data: {
            weeklyAvg: row.weeklyAvg,
            daysCounted: row.daysCounted,
            rank,
            promoted,
            demoted,
            xpAwarded: xp,
          },
        });

        if (xp > 0) await awardXp(row.userId, xp);
        if (promoted) {
          await prisma.userGamification.update({
            where: { userId: row.userId },
            data: { currentTier: newTier },
          });
          await awardAchievement(row.userId, ACHIEVEMENTS.league_promoted.slug);
        } else if (demoted) {
          await prisma.userGamification.update({
            where: { userId: row.userId },
            data: { currentTier: newTier },
          });
        }
        if (rank <= 10) {
          await awardAchievement(row.userId, ACHIEVEMENTS.league_top10.slug);
        }

        if (promoted) {
          await emitGamificationNotification({
            userId: row.userId,
            type: 'gamification.league.promoted',
            params: { tier: newTier },
            link: '/compete/league',
          });
        } else if (demoted) {
          await emitGamificationNotification({
            userId: row.userId,
            type: 'gamification.league.demoted',
            params: { tier: newTier },
            link: '/compete/league',
          });
        }
        if (rank <= 10) {
          await emitGamificationNotification({
            userId: row.userId,
            type: 'gamification.league.top10',
            link: '/compete/league',
          });
        }
      }

      processed += 1;
    }
  }

  if (!dryRun) {
    await prisma.leagueSeason.update({
      where: { id: seasonId },
      data: { status: 'closed', closedAt: new Date() },
    });
    await invalidateWeekLeaderboardCache(season.weekStart);
    await ensureOpenSeason();
  }

  return { ok: true, seasonId, processed, dryRun };
}

async function runLeagueWeekCloseBatch({ dryRun = false, now = new Date() } = {}) {
  const todayKey = now.toISOString().slice(0, 10);
  const openSeasons = await prisma.leagueSeason.findMany({
    where: { status: 'open', weekEnd: { lt: todayKey } },
  });

  const results = [];
  for (const season of openSeasons) {
    results.push(await closeSeason(season.id, { dryRun }));
  }

  return {
    ok: true,
    dryRun,
    closed: results.length,
    results,
  };
}

/**
 * Public league badge for community surfaces (tier + optional rank).
 * Rank is omitted unless the viewer is the user or showOnLeaderboard is enabled.
 * @returns {Promise<Map<string, { tier: string, rank?: number }>>}
 */
async function getLeagueBadgesForUsers(userIds, viewerId = null) {
  const unique = [...new Set((userIds || []).filter(Boolean))];
  const result = new Map();
  if (!unique.length) return result;

  const [settingsRows, userRows, season] = await Promise.all([
    prisma.userSettings.findMany({
      where: { userId: { in: unique } },
      select: { userId: true, leagueOptIn: true, showOnLeaderboard: true },
    }),
    prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, role: true },
    }),
    ensureOpenSeason(),
  ]);

  const settingsMap = new Map(settingsRows.map((s) => [s.userId, s]));
  const roleMap = new Map(userRows.map((u) => [u.id, u.role]));

  const eligible = unique.filter((id) => {
    if (roleMap.get(id) !== 'athlete') return false;
    return settingsMap.get(id)?.leagueOptIn === true;
  });
  if (!eligible.length) return result;

  const [memberships, gamificationRows] = await Promise.all([
    prisma.leagueMembership.findMany({
      where: { userId: { in: eligible }, seasonId: season.id },
      select: { userId: true, tier: true },
    }),
    prisma.userGamification.findMany({
      where: { userId: { in: eligible } },
      select: { userId: true, currentTier: true },
    }),
  ]);
  const membershipMap = new Map(memberships.map((m) => [m.userId, m]));
  const gamificationMap = new Map(gamificationRows.map((g) => [g.userId, g]));

  const tierForUser = (uid) =>
    membershipMap.get(uid)?.tier ?? gamificationMap.get(uid)?.currentTier ?? 'bronze';

  const tiersNeeded = [...new Set(eligible.map(tierForUser))];
  const { dateKeys, weekStart } = getLeagueWeekBounds();
  const rankByUserId = new Map();

  await Promise.all(
    tiersNeeded.map(async (tier) => {
      const members = await prisma.leagueMembership.findMany({
        where: { seasonId: season.id, tier },
        select: { userId: true },
      });
      if (!members.length) return;
      const allIds = members.map((m) => m.userId);
      const statsMap = await resolvePodStatsMap(allIds, dateKeys, weekStart, tier);
      const ranked = allIds
        .map((uid) => ({
          userId: uid,
          ...(statsMap.get(uid) || { qualified: false, weeklyAvg: null, daysCounted: 0 }),
        }))
        .filter((row) => row.qualified)
        .sort((a, b) => {
          const avgB = b.weeklyAvg ?? -1;
          const avgA = a.weeklyAvg ?? -1;
          if (avgB !== avgA) return avgB - avgA;
          return (b.daysCounted ?? 0) - (a.daysCounted ?? 0);
        });
      ranked.forEach((row, idx) => rankByUserId.set(row.userId, idx + 1));
    }),
  );

  for (const uid of eligible) {
    const tier = tierForUser(uid);
    const settings = settingsMap.get(uid);
    const isSelf = Boolean(viewerId && uid === viewerId);
    const showRank = isSelf || settings?.showOnLeaderboard === true;
    const badge = { tier };
    if (showRank) {
      const rank = rankByUserId.get(uid);
      if (rank != null) badge.rank = rank;
    }
    result.set(uid, badge);
  }

  return result;
}

module.exports = {
  getLeagueWeekBounds,
  ensureOpenSeason,
  computeWeeklyStats,
  ensureLeagueMembership,
  getCurrentLeagueStatus,
  getLeagueBadgesForUsers,
  getLeaderboard,
  closeSeason,
  runLeagueWeekCloseBatch,
};
