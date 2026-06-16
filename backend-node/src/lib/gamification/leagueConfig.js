/**
 * Taqwin Score League — tiers, XP rewards, achievements.
 */

const TIERS = ['bronze', 'silver', 'gold', 'diamond'];

const TIER_ORDER = { bronze: 0, silver: 1, gold: 2, diamond: 3 };

const MIN_DAYS_TO_RANK = 3;

const PROMOTE_FRACTION = 0.2;
const DEMOTE_FRACTION = 0.2;

const XP_PROMOTED = 50;
const XP_TOP10_IN_TIER = 25;

const ACHIEVEMENTS = {
  league_first_week: {
    slug: 'league_first_week',
    icon: 'emoji_events',
  },
  league_promoted: {
    slug: 'league_promoted',
    icon: 'trending_up',
  },
  league_top10: {
    slug: 'league_top10',
    icon: 'military_tech',
  },
};

function tierIndex(tier) {
  return TIER_ORDER[tier] ?? 0;
}

function tierFromIndex(idx) {
  return TIERS[Math.min(TIERS.length - 1, Math.max(0, idx))];
}

function promoteTier(tier) {
  return tierFromIndex(tierIndex(tier) + 1);
}

function demoteTier(tier) {
  return tierFromIndex(tierIndex(tier) - 1);
}

module.exports = {
  TIERS,
  TIER_ORDER,
  MIN_DAYS_TO_RANK,
  PROMOTE_FRACTION,
  DEMOTE_FRACTION,
  XP_PROMOTED,
  XP_TOP10_IN_TIER,
  ACHIEVEMENTS,
  tierIndex,
  tierFromIndex,
  promoteTier,
  demoteTier,
};
