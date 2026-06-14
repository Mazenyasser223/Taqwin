/** Tunable For You ranking weights — override via env (e.g. REC_WEIGHT_FOLLOW=55). */

function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

const WEIGHTS = {
  follow: envInt('REC_WEIGHT_FOLLOW', 50),
  ring: envInt('REC_WEIGHT_RING', 40),
  mutual: envInt('REC_WEIGHT_MUTUAL', 25),
  gymPeer: envInt('REC_WEIGHT_GYM_PEER', 20),
  gymMention: envInt('REC_WEIGHT_GYM_MENTION', 15),
  tag: envInt('REC_WEIGHT_TAG', 10),
  savedAuthor: envInt('REC_WEIGHT_SAVED_AUTHOR', 15),
  groupMember: envInt('REC_WEIGHT_GROUP_MEMBER', 10),
  recentEngagement: envInt('REC_WEIGHT_RECENT_ENGAGEMENT', 18),
  secondDegree: envInt('REC_WEIGHT_SECOND_DEGREE', 8),
  fitnessGoalExact: envInt('REC_WEIGHT_GOAL_EXACT', 12),
  fitnessGoalRelated: envInt('REC_WEIGHT_GOAL_RELATED', 6),
  keywordMatch: envInt('REC_WEIGHT_KEYWORD', 4),
  recencyBoost: envInt('REC_WEIGHT_RECENCY_24H', 5),
  engagementLogMult: envInt('REC_WEIGHT_ENGAGEMENT_LOG', 8),
  consumedPost: envInt('REC_WEIGHT_CONSUMED', -35),
  recentlyServed: envInt('REC_WEIGHT_RECENTLY_SERVED', -8),
  roleAffinityMax: envInt('REC_WEIGHT_ROLE_AFFINITY', 3),
};

const POOL = {
  lookbackDays: envInt('REC_LOOKBACK_DAYS', 14),
  trendingLookbackDays: envInt('REC_TRENDING_LOOKBACK_DAYS', 7),
  candidatePoolSize: envInt('REC_CANDIDATE_POOL', 180),
  scoreBufferSize: envInt('REC_SCORE_BUFFER', 60),
  recentEngagementDays: envInt('REC_RECENT_ENGAGEMENT_DAYS', 7),
  interestLookbackDays: envInt('REC_INTEREST_LOOKBACK_DAYS', 30),
  servedPostTtlMs: envInt('REC_SERVED_TTL_MS', 86_400_000),
  servedPostMax: envInt('REC_SERVED_MAX', 100),
  maxPerAuthorInWindow: envInt('REC_MAX_PER_AUTHOR', 2),
  diversityWindowSize: envInt('REC_DIVERSITY_WINDOW', 10),
};

/** Normalize fitness goals into coarse buckets for related-goal matching. */
const GOAL_BUCKETS = {
  strength: ['build strength', 'muscle', 'hypertrophy', 'recomposition', 'bulk', 'gain muscle'],
  endurance: ['endurance', 'cardio', 'weight loss', 'lose weight', 'cutting', 'fat loss', 'lose fat'],
  general: ['general fitness', 'maintenance', 'health', 'wellness', 'stay fit'],
};

module.exports = {
  WEIGHTS,
  POOL,
  GOAL_BUCKETS,
};
