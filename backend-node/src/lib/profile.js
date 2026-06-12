/**
 * Role-specific profiles — athlete_profiles and gym_profiles.
 */
const { prisma } = require('../db');

function isGymRole(role) {
  return role === 'gym';
}

function profileRelationForRole(role) {
  return isGymRole(role) ? 'gymProfile' : 'athleteProfile';
}

/** Prisma include for both profile tables (map to `profile` in responses). */
const PROFILE_INCLUDE = {
  athleteProfile: true,
  gymProfile: true,
};

/** Public author fields for community / lists. */
const AUTHOR_PROFILE_SELECT = {
  athleteProfile: {
    select: { displayName: true, avatarUrl: true, coverUrl: true },
  },
  gymProfile: {
    select: { displayName: true, avatarUrl: true, coverUrl: true, businessName: true },
  },
};

const USER_PUBLIC_SELECT = {
  id: true,
  role: true,
  ...AUTHOR_PROFILE_SELECT,
};

function resolveProfile(user) {
  if (!user) return null;
  if (user.profile !== undefined) return user.profile;
  return isGymRole(user.role) ? user.gymProfile ?? null : user.athleteProfile ?? null;
}

function attachProfile(user) {
  if (!user) return user;
  const { athleteProfile: _athleteProfile, gymProfile: _gymProfile, profile: _legacy, ...rest } = user;
  return { ...rest, profile: resolveProfile(user) };
}

function attachProfileDeep(value) {
  if (Array.isArray(value)) return value.map(attachProfileDeep);
  if (!value || typeof value !== 'object') return value;
  if ('athleteProfile' in value || 'gymProfile' in value || 'role' in value) {
    return attachProfile(value);
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = attachProfileDeep(v);
  }
  return out;
}

async function getOrCreateProfile(userId, role = 'athlete') {
  if (isGymRole(role)) {
    const existing = await prisma.gymProfile.findUnique({ where: { userId } });
    if (existing) return existing;
    return prisma.gymProfile.create({ data: { userId } });
  }
  const existing = await prisma.athleteProfile.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.athleteProfile.create({ data: { userId } });
}

async function upsertProfile(userId, role, data) {
  if (isGymRole(role)) {
    return prisma.gymProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }
  return prisma.athleteProfile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

async function findProfileByUserId(userId, role) {
  if (isGymRole(role)) {
    return prisma.gymProfile.findUnique({ where: { userId } });
  }
  return prisma.athleteProfile.findUnique({ where: { userId } });
}

/** Search users by display/business name across both profile tables. */
function profileNameSearchFilter(q) {
  return {
    OR: [
      { athleteProfile: { displayName: { contains: q, mode: 'insensitive' } } },
      { gymProfile: { displayName: { contains: q, mode: 'insensitive' } } },
      { gymProfile: { businessName: { contains: q, mode: 'insensitive' } } },
    ],
  };
}

module.exports = {
  PROFILE_INCLUDE,
  AUTHOR_PROFILE_SELECT,
  USER_PUBLIC_SELECT,
  attachProfile,
  attachProfileDeep,
  findProfileByUserId,
  getOrCreateProfile,
  isGymRole,
  profileNameSearchFilter,
  profileRelationForRole,
  resolveProfile,
  upsertProfile,
};
