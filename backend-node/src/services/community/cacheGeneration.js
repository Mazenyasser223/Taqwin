const { redisIncr, redisGetString } = require('../../lib/redis');

const PROFILE_GEN_KEY = 'community:profile:gen';
const INBOX_GEN_KEY = 'community:inbox:gen';
const GROUPS_GEN_KEY = 'community:groups:gen';

async function getProfileCacheGeneration() {
  const fromRedis = await redisGetString(PROFILE_GEN_KEY);
  return fromRedis ?? '0';
}

async function bumpProfileCacheGeneration() {
  await redisIncr(PROFILE_GEN_KEY);
}

async function getInboxCacheGeneration() {
  const fromRedis = await redisGetString(INBOX_GEN_KEY);
  return fromRedis ?? '0';
}

async function bumpInboxCacheGeneration() {
  await redisIncr(INBOX_GEN_KEY);
}

async function getGroupsCacheGeneration() {
  const fromRedis = await redisGetString(GROUPS_GEN_KEY);
  return fromRedis ?? '0';
}

async function bumpGroupsCacheGeneration() {
  await redisIncr(GROUPS_GEN_KEY);
}

module.exports = {
  getProfileCacheGeneration,
  bumpProfileCacheGeneration,
  getInboxCacheGeneration,
  bumpInboxCacheGeneration,
  getGroupsCacheGeneration,
  bumpGroupsCacheGeneration,
};
