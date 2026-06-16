/**
 * Achievement metadata — league + challenge badges.
 */
const { ACHIEVEMENTS } = require('./leagueConfig');
const { CHALLENGE_TEMPLATES } = require('./challengeConfig');

const ACHIEVEMENT_CATALOG = {
  [ACHIEVEMENTS.league_first_week.slug]: {
    slug: ACHIEVEMENTS.league_first_week.slug,
    icon: ACHIEVEMENTS.league_first_week.icon,
    category: 'league',
  },
  [ACHIEVEMENTS.league_promoted.slug]: {
    slug: ACHIEVEMENTS.league_promoted.slug,
    icon: ACHIEVEMENTS.league_promoted.icon,
    category: 'league',
  },
  [ACHIEVEMENTS.league_top10.slug]: {
    slug: ACHIEVEMENTS.league_top10.slug,
    icon: ACHIEVEMENTS.league_top10.icon,
    category: 'league',
  },
};

for (const template of CHALLENGE_TEMPLATES) {
  ACHIEVEMENT_CATALOG[template.badgeSlug] = {
    slug: template.badgeSlug,
    icon: template.icon,
    category: 'challenge',
    challengeSlug: template.slug,
  };
}

ACHIEVEMENT_CATALOG.challenge_duel_win = {
  slug: 'challenge_duel_win',
  icon: 'sports_martial_arts',
  category: 'social',
};

function getAchievementMeta(slug) {
  return ACHIEVEMENT_CATALOG[slug] ?? { slug, icon: 'military_tech', category: 'other' };
}

function listAchievementCatalog() {
  return Object.values(ACHIEVEMENT_CATALOG);
}

module.exports = {
  ACHIEVEMENT_CATALOG,
  getAchievementMeta,
  listAchievementCatalog,
};
