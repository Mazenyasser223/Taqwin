/**
 * Gamification API — Phase 0–4 (fitness score, league, challenges, social, achievements).
 *
 *   GET   /api/gamification/me
 *   GET   /api/gamification/dashboard
 *   PATCH /api/gamification/settings
 *   GET   /api/gamification/achievements
 *   POST  /api/gamification/league/join
 *   GET   /api/gamification/league/current
 *   GET   /api/gamification/league/bootstrap?scope=league|friends|gym|global
 *   GET   /api/gamification/league/leaderboard?scope=league|friends|gym|global
 *   GET   /api/gamification/challenges
 *   POST  /api/gamification/challenges/:slug/join
 *   GET   /api/gamification/challenges/participant/:id
 *   POST  /api/gamification/challenges/participant/:id/leave
 *   GET   /api/gamification/social
 *   POST  /api/gamification/duels
 *   POST  /api/gamification/duels/:id/accept|decline|cancel
 *   POST  /api/gamification/squads
 *   POST  /api/gamification/squads/:id/join|start|leave
 */
const express = require('express');
const { z } = require('zod');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  getGamificationMe,
  getGamificationDashboard,
  updateGamificationSettings,
  getGamificationAchievements,
  invalidateGamificationDashboardCache,
} = require('../lib/gamification/gamificationService');
const {
  ensureLeagueMembership,
  getCurrentLeagueStatus,
  getLeagueBootstrap,
  getLeaderboard,
  invalidateLeagueContextCache,
} = require('../lib/gamification/leagueService');
const {
  listChallengesForUser,
  getChallengeSummaryForUser,
  joinChallenge,
  getParticipantDetail,
  leaveChallenge,
} = require('../lib/gamification/challengeService');
const { getSocialOverview, invalidateSocialCache } = require('../lib/gamification/socialService');
const {
  inviteDuel,
  acceptDuel,
  declineDuel,
  cancelDuel,
} = require('../lib/gamification/duelService');
const {
  createSquad,
  joinSquad,
  startSquad,
  leaveSquad,
} = require('../lib/gamification/squadService');

const router = express.Router();
router.use(authMiddleware);
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  next();
});

const settingsSchema = {
  body: z
    .object({
      leagueOptIn: z.boolean().optional(),
      leaderboardVisibility: z.enum(['off', 'friends', 'gym', 'global']).optional(),
      showOnLeaderboard: z.boolean().optional(),
      challengeNotifications: z.boolean().optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'No fields to update' }),
};

const leaderboardSchema = z.object({
  query: z.object({
    scope: z.enum(['league', 'friends', 'gym', 'global']).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    prefetch: z.string().max(64).optional(),
  }),
});

const slugSchema = z.object({
  params: z.object({
    slug: z.string().min(1).max(64),
  }),
});

const participantSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

const duelInviteSchema = z.object({
  body: z.object({
    opponentId: z.string().uuid(),
    templateSlug: z.string().min(1).max(64),
  }),
});

const squadCreateSchema = z.object({
  body: z.object({
    templateSlug: z.string().min(1).max(64),
    name: z.string().max(64).optional(),
  }),
});

router.get('/me', async (req, res, next) => {
  try {
    const data = await getGamificationMe(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard', async (req, res, next) => {
  try {
    const data = await getGamificationDashboard(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/achievements', async (req, res, next) => {
  try {
    const data = await getGamificationAchievements(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.patch('/settings', validate(settingsSchema), async (req, res, next) => {
  try {
    const settings = await updateGamificationSettings(req.user.id, req.body);
    res.json({ settings });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
});

router.post('/league/join', async (req, res, next) => {
  try {
    await updateGamificationSettings(req.user.id, { leagueOptIn: true });
    invalidateLeagueContextCache(req.user.id);
    invalidateGamificationDashboardCache(req.user.id);
    const membership = await ensureLeagueMembership(req.user.id);
    const league = await getCurrentLeagueStatus(req.user.id, { light: true });
    res.json({ ok: true, membershipId: membership?.id ?? null, league });
  } catch (err) {
    next(err);
  }
});

router.get('/league/current', async (req, res, next) => {
  try {
    const light = req.query.light === '1' || req.query.light === 'true';
    const league = await getCurrentLeagueStatus(req.user.id, { light });
    res.json(league);
  } catch (err) {
    next(err);
  }
});

router.get('/league/bootstrap', validate(leaderboardSchema), async (req, res, next) => {
  try {
    const scope = req.query.scope || 'league';
    const limit = req.query.limit || 50;
    const prefetchScopes = req.query.prefetch
      ? req.query.prefetch.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const data = await getLeagueBootstrap(req.user.id, scope, limit, prefetchScopes);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/league/leaderboard', validate(leaderboardSchema), async (req, res, next) => {
  try {
    const scope = req.query.scope || 'league';
    const limit = req.query.limit || 50;
    const data = await getLeaderboard(req.user.id, scope, limit);
    res.json(data);
  } catch (err) {
    if (err.status === 403 || err.status === 400) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

router.get('/challenges', async (req, res, next) => {
  try {
    const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const data = await listChallengesForUser(req.user.id, { refresh });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/challenges/summary', async (req, res, next) => {
  try {
    const data = await getChallengeSummaryForUser(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/challenges/:slug/join', validate(slugSchema), async (req, res, next) => {
  try {
    const data = await joinChallenge(req.user.id, req.params.slug);
    invalidateGamificationDashboardCache(req.user.id);
    res.status(201).json(data);
  } catch (err) {
    if (err.status === 404 || err.status === 409) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

router.get('/challenges/participant/:id', validate(participantSchema), async (req, res, next) => {
  try {
    const data = await getParticipantDetail(req.user.id, req.params.id);
    res.json(data);
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
});

router.post('/challenges/participant/:id/leave', validate(participantSchema), async (req, res, next) => {
  try {
    const data = await leaveChallenge(req.user.id, req.params.id);
    invalidateGamificationDashboardCache(req.user.id);
    res.json(data);
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
});

router.get('/social', async (req, res, next) => {
  try {
    const data = await getSocialOverview(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/duels', validate(duelInviteSchema), async (req, res, next) => {
  try {
    const data = await inviteDuel(req.user.id, req.body.opponentId, req.body.templateSlug);
    invalidateSocialCache(req.user.id);
    invalidateSocialCache(req.body.opponentId);
    res.status(201).json(data);
  } catch (err) {
    if (err.status === 400 || err.status === 403 || err.status === 404 || err.status === 409) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/duels/:id/accept', validate(participantSchema), async (req, res, next) => {
  try {
    const data = await acceptDuel(req.user.id, req.params.id);
    invalidateSocialCache(req.user.id);
    res.json(data);
  } catch (err) {
    if (err.status === 404 || err.status === 409) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/duels/:id/decline', validate(participantSchema), async (req, res, next) => {
  try {
    const data = await declineDuel(req.user.id, req.params.id);
    invalidateSocialCache(req.user.id);
    res.json(data);
  } catch (err) {
    if (err.status === 404 || err.status === 409) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/duels/:id/cancel', validate(participantSchema), async (req, res, next) => {
  try {
    const data = await cancelDuel(req.user.id, req.params.id);
    invalidateSocialCache(req.user.id);
    res.json(data);
  } catch (err) {
    if (err.status === 404 || err.status === 409) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/squads', validate(squadCreateSchema), async (req, res, next) => {
  try {
    const data = await createSquad(req.user.id, req.body.templateSlug, req.body.name);
    invalidateSocialCache(req.user.id);
    res.status(201).json(data);
  } catch (err) {
    if (err.status === 404 || err.status === 409) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/squads/:id/join', validate(participantSchema), async (req, res, next) => {
  try {
    const data = await joinSquad(req.user.id, req.params.id);
    invalidateSocialCache(req.user.id);
    res.json(data);
  } catch (err) {
    if (err.status === 403 || err.status === 404 || err.status === 409) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/squads/:id/start', validate(participantSchema), async (req, res, next) => {
  try {
    const data = await startSquad(req.user.id, req.params.id);
    invalidateSocialCache(req.user.id);
    res.json(data);
  } catch (err) {
    if (err.status === 400 || err.status === 404 || err.status === 409) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/squads/:id/leave', validate(participantSchema), async (req, res, next) => {
  try {
    const data = await leaveSquad(req.user.id, req.params.id);
    invalidateSocialCache(req.user.id);
    res.json(data);
  } catch (err) {
    if (err.status === 404 || err.status === 409) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
