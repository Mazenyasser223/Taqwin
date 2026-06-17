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
const { listMutualFriendIds } = require('./socialChallengeHelpers');

const LEADERBOARD_MEM_CACHE_TTL_MS = Number(process.env.GAMIFICATION_LB_MEM_CACHE_TTL_MS || 120000);
const leaderboardMemCache = new Map();
const VALID_SCOPES = new Set(['league', 'friends', 'gym', 'global']);
const LEAGUE_CTX_CACHE_MS = Number(process.env.GAMIFICATION_LEAGUE_CTX_CACHE_TTL_MS || 45000);
const leagueContextCache = new Map();

function invalidateLeagueContextCache(userId) {
  if (userId) leagueContextCache.delete(userId);
}

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

let openSeasonCache = { season: null, weekStart: null, fetchedAt: 0 };
const OPEN_SEASON_CACHE_MS = 60_000;
const podSizeCache = new Map();
const POD_SIZE_CACHE_MS = 120_000;

async function ensureOpenSeason(now = new Date()) {
  const { weekStart, weekEnd } = getLeagueWeekBounds(now);
  if (
    openSeasonCache.season &&
    openSeasonCache.weekStart === weekStart &&
    Date.now() - openSeasonCache.fetchedAt < OPEN_SEASON_CACHE_MS
  ) {
    return openSeasonCache.season;
  }

  let season = await prisma.leagueSeason.findUnique({ where: { weekStart } });
  if (!season) {
    season = await prisma.leagueSeason.create({
      data: { id: randomUUID(), weekStart, weekEnd, status: 'open' },
    });
  }
  openSeasonCache = { season, weekStart, fetchedAt: Date.now() };
  return season;
}

async function getPodSize(seasonId, tier) {
  const key = `${seasonId}:${tier}`;
  const hit = podSizeCache.get(key);
  if (hit && Date.now() - hit.at < POD_SIZE_CACHE_MS) return hit.count;
  const count = await prisma.leagueMembership.count({ where: { seasonId, tier } });
  podSizeCache.set(key, { count, at: Date.now() });
  return count;
}

function statsFromMembership(row) {
  const qualified = row.daysCounted >= MIN_DAYS_TO_RANK && row.weeklyAvg != null;
  return {
    weeklyAvg: row.weeklyAvg,
    daysCounted: row.daysCounted,
    qualified,
  };
}

async function computeWeeklyStats(userId, dateKeys) {
  const batch = await computeWeeklyStatsBatch([userId], dateKeys);
  return batch.get(userId) || { weeklyAvg: null, daysCounted: 0, qualified: false };
}

async function computeWeeklyStatsBatch(userIds, dateKeys) {
  const uniqueIds = [...new Set((userIds || []).filter(Boolean))];
  const result = new Map();
  if (!uniqueIds.length) return result;

  const rows = await prisma.athleteDailyScore.findMany({
    where: { userId: { in: uniqueIds }, dateKey: { in: dateKeys } },
    select: { userId: true, score: true },
  });

  const scoresByUser = new Map();
  for (const uid of uniqueIds) scoresByUser.set(uid, []);
  for (const row of rows) {
    const bucket = scoresByUser.get(row.userId);
    if (bucket) bucket.push(row);
  }

  for (const uid of uniqueIds) {
    const scored = (scoresByUser.get(uid) || []).filter((r) => r.score > 0);
    const daysCounted = scored.length;
    if (daysCounted === 0) {
      result.set(uid, { weeklyAvg: null, daysCounted: 0, qualified: false });
      continue;
    }
    const weeklyAvg = Math.round(scored.reduce((s, r) => s + r.score, 0) / daysCounted);
    result.set(uid, {
      weeklyAvg,
      daysCounted,
      qualified: daysCounted >= MIN_DAYS_TO_RANK,
    });
  }

  return result;
}

async function resolvePodStatsMap(userIds, dateKeys, weekStart, tier) {
  const map = new Map();
  if (!userIds.length) return map;

  let cached = null;
  if (tier) cached = await getCachedPodStats(weekStart, tier);

  const missing = [];
  for (const uid of userIds) {
    const hit = cached?.[uid];
    if (hit) map.set(uid, hit);
    else missing.push(uid);
  }

  if (missing.length > 0) {
    const batch = await computeWeeklyStatsBatch(missing, dateKeys);
    for (const [uid, stats] of batch) map.set(uid, stats);
  }

  if (tier && (missing.length > 0 || !cached)) {
    await setCachedPodStats(weekStart, tier, Object.fromEntries(map));
  }

  return map;
}

async function ensureLeagueMembership(userId, seasonId = null, ctx = null) {
  const settings = ctx?.settings ?? (await getOrCreateUserSettings(userId));
  if (!settings.leagueOptIn) return null;

  const gamification = ctx?.gamification ?? (await getOrCreateUserGamificationLocal(userId));
  const season =
    ctx?.season ??
    (seasonId
      ? await prisma.leagueSeason.findUnique({ where: { id: seasonId } })
      : await ensureOpenSeason());
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
  return profile?.displayName || 'Athlete';
}

function avatarForUser(user) {
  return user.athleteProfile?.communityAvatarUrl || user.athleteProfile?.avatarUrl || null;
}

async function loadLeaderboardCandidates(seasonId, tier, viewerId, scope) {
  const where = { seasonId };
  if (tier) where.tier = tier;
  // Global scope filters opted-in users; league/friends/gym use membership rows directly.
  if (scope === 'global') {
    where.user = { settings: { leagueOptIn: true } };
  }

  if (scope === 'friends') {
    const friendIds = await listMutualFriendIds(viewerId);
    where.userId = { in: friendIds };
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
  }

  const rows = await prisma.leagueMembership.findMany({
    where,
    select: {
      userId: true,
      tier: true,
      weeklyAvg: true,
      daysCounted: true,
      rank: true,
      user: {
        select: {
          id: true,
          athleteProfile: {
            select: { displayName: true, communityAvatarUrl: true, avatarUrl: true },
          },
          settings: { select: { showOnLeaderboard: true, leaderboardVisibility: true } },
        },
      },
    },
  });

  return rows;
}

async function buildLeaderboardEntries(season, tier, viewerId, scope, limit = 50) {
  const { dateKeys } = getLeagueWeekBounds(new Date(`${season.weekStart}T12:00:00.000Z`));
  const candidates = await loadLeaderboardCandidates(season.id, tier, viewerId, scope);

  // Stored membership stats — one row per candidate, no live score aggregation batch.
  const statsMap = new Map(candidates.map((row) => [row.userId, statsFromMembership(row)]));
  const viewerStats = statsMap.get(viewerId);
  if (!viewerStats?.qualified) {
    const live = await computeWeeklyStats(viewerId, dateKeys);
    statsMap.set(viewerId, live);
  }

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

function leaderboardMemCacheKey(seasonId, tier, viewerId, scope, limit) {
  return `${seasonId}:${tier ?? 'all'}:${viewerId}:${scope}:${limit}`;
}

async function buildLeaderboardEntriesCached(season, tier, viewerId, scope, limit = 50) {
  const key = leaderboardMemCacheKey(season.id, tier, viewerId, scope, limit);
  const hit = leaderboardMemCache.get(key);
  if (hit && Date.now() - hit.at < LEADERBOARD_MEM_CACHE_TTL_MS) {
    return hit.entries;
  }
  const entries = await buildLeaderboardEntries(season, tier, viewerId, scope, limit);
  leaderboardMemCache.set(key, { at: Date.now(), entries });
  if (leaderboardMemCache.size > 500) {
    const cutoff = Date.now() - LEADERBOARD_MEM_CACHE_TTL_MS;
    for (const [k, v] of leaderboardMemCache) {
      if (v.at < cutoff) leaderboardMemCache.delete(k);
    }
  }
  return entries;
}

function buildLeaderboardPayload(season, tierFilter, viewerId, scope, limit, entries) {
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

/**
 * Batch league prerequisites in minimal round trips (settings, season, membership).
 */
async function resolveLeagueContextUncached(userId) {
  const [settings, gamification, season, priorMembership] = await Promise.all([
    getOrCreateUserSettings(userId),
    getOrCreateUserGamificationLocal(userId),
    ensureOpenSeason(),
    prisma.leagueMembership.findFirst({
      where: { userId },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  let activeSettings = settings;
  let optedIn = Boolean(settings.leagueOptIn);
  if (!optedIn && priorMembership) {
    activeSettings = await prisma.userSettings.update({
      where: { userId },
      data: { leagueOptIn: true },
    });
    optedIn = true;
  }
  if (!optedIn) return { optedIn: false };

  const ctx = { settings: activeSettings, gamification, season };
  const membership = await ensureLeagueMembership(userId, season.id, ctx);
  return { optedIn: true, settings: activeSettings, gamification, season, membership };
}

async function resolveLeagueContext(userId) {
  const hit = leagueContextCache.get(userId);
  if (hit && Date.now() - hit.at < LEAGUE_CTX_CACHE_MS) return hit.ctx;
  const ctx = await resolveLeagueContextUncached(userId);
  leagueContextCache.set(userId, { ctx, at: Date.now() });
  return ctx;
}

/**
 * Persist league opt-in from settings, or auto-heal when the user already has a membership row.
 */
async function resolveLeagueOptIn(userId, settings) {
  if (settings.leagueOptIn) {
    return { optedIn: true, settings };
  }
  const priorMembership = await prisma.leagueMembership.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (!priorMembership) {
    return { optedIn: false, settings };
  }
  const healed = await prisma.userSettings.update({
    where: { userId },
    data: { leagueOptIn: true },
  });
  return { optedIn: true, settings: healed };
}

/**
 * @param {string} userId
 * @param {{ light?: boolean }} [opts] — light skips heavy rank/stats recompute (fast opted-in check)
 */
async function getCurrentLeagueStatus(userId, opts = {}) {
  const ctx = await resolveLeagueContext(userId);
  if (!ctx.optedIn) {
    return { optedIn: false };
  }
  const { gamification, season, membership } = ctx;

  if (opts.light) {
    return {
      optedIn: true,
      season: {
        id: season.id,
        weekStart: season.weekStart,
        weekEnd: season.weekEnd,
        status: season.status,
      },
      tier: membership?.tier ?? gamification.currentTier,
      weeklyAvg: membership?.weeklyAvg ?? null,
      daysCounted: membership?.daysCounted ?? 0,
      daysRequired: MIN_DAYS_TO_RANK,
      rank: membership?.rank ?? null,
      podSize: 0,
      achievements: [],
    };
  }

  const { dateKeys } = getLeagueWeekBounds();
  const stats = await computeWeeklyStats(userId, dateKeys);

  let rank = null;
  let podSize = 0;
  if (membership) {
    const rankPromise =
      stats.qualified ? computePodRank(userId, season.id, membership.tier) : Promise.resolve(null);
    [rank, podSize] = await Promise.all([
      rankPromise,
      getPodSize(season.id, membership.tier),
    ]);
  }

  if (
    membership &&
    stats.weeklyAvg != null &&
    (membership.weeklyAvg !== stats.weeklyAvg ||
      membership.daysCounted !== stats.daysCounted ||
      membership.rank !== rank)
  ) {
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
    podSize,
    achievements,
  };
}

function leagueStatusFromMembership(season, membership, gamification, podSize) {
  return {
    optedIn: true,
    season: {
      id: season.id,
      weekStart: season.weekStart,
      weekEnd: season.weekEnd,
      status: season.status,
    },
    tier: membership?.tier ?? gamification.currentTier,
    weeklyAvg: membership?.weeklyAvg ?? null,
    daysCounted: membership?.daysCounted ?? 0,
    daysRequired: MIN_DAYS_TO_RANK,
    rank: membership?.rank ?? null,
    podSize: podSize ?? 0,
    achievements: [],
  };
}

/**
 * Single round-trip payload for the league page (status + default-scope leaderboard).
 * Optional prefetchScopes loads additional tab leaderboards in parallel (same response).
 */
async function getLeagueBootstrap(userId, scope = 'league', limit = 50, prefetchScopes = []) {
  const ctx = await resolveLeagueContext(userId);
  if (!ctx.optedIn) {
    return { league: { optedIn: false }, leaderboard: null };
  }
  const { gamification, season, membership } = ctx;
  const tierFilter = scope === 'global' ? null : membership?.tier ?? 'bronze';

  const extraScopes = prefetchScopes.filter(
    (s) => VALID_SCOPES.has(s) && s !== scope,
  );

  const [podSize, entries, ...prefetchedEntries] = await Promise.all([
    membership ? getPodSize(season.id, membership.tier) : Promise.resolve(0),
    buildLeaderboardEntriesCached(season, tierFilter, userId, scope, limit),
    ...extraScopes.map((s) => {
      const tier = s === 'global' ? null : membership?.tier ?? 'bronze';
      return buildLeaderboardEntriesCached(season, tier, userId, s, limit);
    }),
  ]);

  const league = leagueStatusFromMembership(season, membership, gamification, podSize);

  const result = {
    league,
    leaderboard: buildLeaderboardPayload(season, tierFilter, userId, scope, limit, entries),
  };

  if (extraScopes.length) {
    result.prefetchedLeaderboards = {};
    extraScopes.forEach((s, idx) => {
      const tier = s === 'global' ? null : membership?.tier ?? 'bronze';
      result.prefetchedLeaderboards[s] = buildLeaderboardPayload(
        season,
        tier,
        userId,
        s,
        limit,
        prefetchedEntries[idx],
      );
    });
  }

  return result;
}

async function getLeaderboard(userId, scope = 'league', limit = 50) {
  const ctx = await resolveLeagueContext(userId);
  if (!ctx.optedIn) {
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

  const { season, membership } = ctx;
  const tierFilter = scope === 'global' ? null : membership?.tier ?? 'bronze';

  const entries = await buildLeaderboardEntriesCached(season, tierFilter, userId, scope, limit);

  return buildLeaderboardPayload(season, tierFilter, userId, scope, limit, entries);
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
    const statsMap = await computeWeeklyStatsBatch(
      pod.map((m) => m.userId),
      dateKeys,
    );
    const ranked = [];

    for (const m of pod) {
      const stats = statsMap.get(m.userId);
      if (!stats?.qualified) continue;
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
      select: { userId: true, tier: true, rank: true },
    }),
    prisma.userGamification.findMany({
      where: { userId: { in: eligible } },
      select: { userId: true, currentTier: true },
    }),
  ]);
  const membershipMap = new Map(memberships.map((m) => [m.userId, m]));
  const gamificationMap = new Map(gamificationRows.map((g) => [g.userId, g]));

  for (const uid of eligible) {
    const membership = membershipMap.get(uid);
    const tier = membership?.tier ?? gamificationMap.get(uid)?.currentTier ?? 'bronze';
    const settings = settingsMap.get(uid);
    const isSelf = Boolean(viewerId && uid === viewerId);
    const showRank = isSelf || settings?.showOnLeaderboard === true;
    const badge = { tier };
    if (showRank && membership?.rank != null) badge.rank = membership.rank;
    result.set(uid, badge);
  }

  return result;
}

module.exports = {
  getLeagueWeekBounds,
  ensureOpenSeason,
  computeWeeklyStats,
  computeWeeklyStatsBatch,
  resolveLeagueOptIn,
  resolveLeagueContext,
  invalidateLeagueContextCache,
  ensureLeagueMembership,
  getCurrentLeagueStatus,
  getLeagueBootstrap,
  getLeagueBadgesForUsers,
  getLeaderboard,
  closeSeason,
  runLeagueWeekCloseBatch,
};
