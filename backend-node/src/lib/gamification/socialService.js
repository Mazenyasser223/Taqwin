/**
 * Social compete overview — duels, squads, mutual friends.
 */
const { listMutualFriends } = require('./socialChallengeHelpers');
const { listDuelsForUser } = require('./duelService');
const {
  listSquadsForUser,
  listRecruitingSquadsForFriends,
} = require('./squadService');
const { CHALLENGE_TEMPLATES } = require('./challengeConfig');

async function getSocialOverview(userId) {
  const [friends, duels, squads, openSquads] = await Promise.all([
    listMutualFriends(userId),
    listDuelsForUser(userId),
    listSquadsForUser(userId),
    listRecruitingSquadsForFriends(userId),
  ]);

  return {
    friends,
    duels,
    squads,
    openSquads,
    challengeOptions: CHALLENGE_TEMPLATES.map((t) => ({
      slug: t.slug,
      durationDays: t.durationDays,
      target: t.target,
      icon: t.icon,
    })),
  };
}

module.exports = {
  getSocialOverview,
  listMutualFriends,
};
