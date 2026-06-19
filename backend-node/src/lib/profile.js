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

/** Community API — includes communityAvatarUrl; maps to `profile` via attachProfile. */
const COMMUNITY_ATHLETE_SELECT = {
  select: { displayName: true, communityAvatarUrl: true, coverUrl: true, bio: true },
};

const COMMUNITY_GYM_SELECT = {
  select: { displayName: true, communityAvatarUrl: true, coverUrl: true, bio: true, businessName: true },
};

const COMMUNITY_AUTHOR_SELECT = {
  id: true,
  email: true,
  role: true,
  lastSeenAt: true,
  athleteProfile: COMMUNITY_ATHLETE_SELECT,
  gymProfile: COMMUNITY_GYM_SELECT,
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

function resolveProfileGender(user) {
  const profile = resolveProfile(user);
  if (!profile) return null;
  if (profile.gender) return profile.gender;
  const onboarding = profile.onboardingData;
  if (onboarding && typeof onboarding === 'object' && !Array.isArray(onboarding) && onboarding.gender) {
    return String(onboarding.gender);
  }
  return null;
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

const ATHLETE_UPSERT_FIELDS = [
  'displayName',
  'avatarUrl',
  'communityAvatarUrl',
  'coverUrl',
  'bio',
  'dateOfBirth',
  'gender',
  'height',
  'weight',
  'fitnessGoal',
  'fitnessLevel',
  'medicalNotes',
  'onboardingData',
];

const GYM_UPSERT_FIELDS = [
  'displayName',
  'avatarUrl',
  'communityAvatarUrl',
  'coverUrl',
  'bio',
  'businessName',
  'businessAddress',
  'businessPhone',
  'websiteUrl',
];

async function upsertProfile(userId, role, data) {
  const allowed = isGymRole(role) ? GYM_UPSERT_FIELDS : ATHLETE_UPSERT_FIELDS;
  const filtered = Object.fromEntries(
    Object.entries(data || {}).filter(([k, v]) => allowed.includes(k) && v !== undefined),
  );
  if (Object.keys(filtered).length === 0) {
    return getOrCreateProfile(userId, role);
  }
  if (isGymRole(role)) {
    return prisma.gymProfile.upsert({
      where: { userId },
      create: { userId, ...filtered },
      update: filtered,
    });
  }
  return prisma.athleteProfile.upsert({
    where: { userId },
    create: { userId, ...filtered },
    update: filtered,
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

/** Prefix search for browse — names/business names that start with the query. */
function profileNamePrefixSearchFilter(q) {
  return {
    OR: [
      { athleteProfile: { displayName: { startsWith: q, mode: 'insensitive' } } },
      { gymProfile: { displayName: { startsWith: q, mode: 'insensitive' } } },
      { gymProfile: { businessName: { startsWith: q, mode: 'insensitive' } } },
    ],
  };
}

module.exports = {
  PROFILE_INCLUDE,
  AUTHOR_PROFILE_SELECT,
  COMMUNITY_AUTHOR_SELECT,
  USER_PUBLIC_SELECT,
  ATHLETE_UPSERT_FIELDS,
  GYM_UPSERT_FIELDS,
  attachProfile,
  attachProfileDeep,
  findProfileByUserId,
  getOrCreateProfile,
  isGymRole,
  profileNameSearchFilter,
  profileNamePrefixSearchFilter,
  profileRelationForRole,
  resolveProfile,
  resolveProfileGender,
  upsertProfile,
};
