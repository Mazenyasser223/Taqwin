/**
 * Gym owner access checks and membership validation for reception flows.
 */
const { prisma } = require('../db');

async function getOwnedGym(userId) {
  return prisma.gym.findFirst({ where: { ownerId: userId } });
}

async function assertGymOwner(gymId, userId) {
  const gym = await prisma.gym.findUnique({ where: { id: gymId } });
  if (!gym) {
    const err = new Error('Gym not found');
    err.status = 404;
    throw err;
  }
  if (gym.ownerId !== userId) {
    const err = new Error('You do not own this gym');
    err.status = 403;
    throw err;
  }
  return gym;
}

function normalizeGender(raw) {
  if (!raw) return 'unknown';
  const s = String(raw).trim().toLowerCase();
  if (['male', 'm', 'man', 'ذكر'].includes(s)) return 'male';
  if (['female', 'f', 'woman', 'أنثى', 'انثى'].includes(s)) return 'female';
  return 'unknown';
}

function membershipStatus(membership, now = new Date()) {
  if (!membership || !membership.isActive) return 'inactive';
  if (membership.expiresAt && membership.expiresAt < now) return 'expired';
  return 'active';
}

function daysUntilExpiry(expiresAt, now = new Date()) {
  if (!expiresAt) return null;
  const end = new Date(expiresAt);
  end.setHours(23, 59, 59, 999);
  const diff = Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  return diff;
}

async function getActiveMembership(gymId, userId) {
  return prisma.gymMembership.findUnique({
    where: { gymId_userId: { gymId, userId } },
  });
}

async function getOpenVisit(gymId, userId) {
  return prisma.gymCheckIn.findFirst({
    where: { gymId, userId, checkedOutAt: null },
    orderBy: { checkedInAt: 'desc' },
  });
}

/** Batch-load open visits for many members (one query instead of N). */
async function getOpenVisitsForUsers(gymId, userIds) {
  if (!userIds.length) return new Map();
  const visits = await prisma.gymCheckIn.findMany({
    where: { gymId, userId: { in: userIds }, checkedOutAt: null },
    orderBy: { checkedInAt: 'desc' },
  });
  const byUser = new Map();
  for (const visit of visits) {
    if (!byUser.has(visit.userId)) byUser.set(visit.userId, visit);
  }
  return byUser;
}

/** Remove all gym-scoped data for a member; does not delete the Taqwin user account. */
async function removeGymMemberData(client, gymId, userId) {
  const deletedBookings = await client.gymClassBooking.deleteMany({
    where: { gymId, userId },
  });
  const deletedVisits = await client.gymCheckIn.deleteMany({
    where: { gymId, userId },
  });
  const deletedMemberships = await client.gymMembership.deleteMany({
    where: { gymId, userId },
  });
  return {
    deletedBookings: deletedBookings.count,
    deletedVisits: deletedVisits.count,
    deletedMemberships: deletedMemberships.count,
  };
}

/**
 * Remove a member from a gym. Desk-created accounts with no other gym memberships
 * are deleted entirely; pre-existing Taqwin users keep their global account/data.
 */
async function purgeGymMember(client, gymId, userId, membership) {
  const deskCreated = Boolean(membership?.accountCreatedAtDesk);

  if (deskCreated) {
    const otherMemberships = await client.gymMembership.count({
      where: { userId, NOT: { gymId } },
    });
    if (otherMemberships === 0) {
      await client.user.delete({ where: { id: userId } });
      return {
        mode: 'account_deleted',
        userDeleted: true,
        removed: { deletedBookings: null, deletedVisits: null, deletedMemberships: 1 },
      };
    }
  }

  const removed = await removeGymMemberData(client, gymId, userId);
  return {
    mode: 'gym_only',
    userDeleted: false,
    removed,
  };
}

const { resolveProfile, resolveProfileGender } = require('./profile');

const MEMBER_USER_SELECT = {
  id: true,
  email: true,
  phone: true,
  role: true,
  athleteProfile: { select: { displayName: true, avatarUrl: true, gender: true, onboardingData: true } },
};

function extractMemberAddress(profile) {
  const data = profile?.onboardingData;
  if (data && typeof data === 'object' && !Array.isArray(data) && typeof data.address === 'string') {
    return data.address;
  }
  return null;
}

const MEMBERSHIP_PLAN_SELECT = {
  id: true,
  name: true,
  nameAr: true,
  price: true,
  durationDays: true,
  currency: true,
  benefits: true,
};

function formatMemberRow(membership, openVisit, now = new Date()) {
  const status = membershipStatus(membership, now);
  const daysLeft = daysUntilExpiry(membership.expiresAt, now);
  const profile = resolveProfile(membership.user);
  return {
    membershipId: membership.id,
    userId: membership.userId,
    planId: membership.planId ?? null,
    plan: membership.plan ?? null,
    paidAmount: membership.paidAmount ?? null,
    paymentMethod: membership.paymentMethod ?? null,
    paidAt: membership.paidAt ?? null,
    joinedAt: membership.joinedAt,
    expiresAt: membership.expiresAt,
    isActive: membership.isActive,
    accountCreatedAtDesk: Boolean(membership.accountCreatedAtDesk),
    membershipStatus: status,
    daysRemaining: daysLeft,
    isPresent: Boolean(openVisit),
    checkedInAt: openVisit?.checkedInAt ?? null,
    visitId: openVisit?.id ?? null,
    user: membership.user,
    gender: normalizeGender(resolveProfileGender(membership.user)),
    address: extractMemberAddress(profile),
  };
}

module.exports = {
  getOwnedGym,
  assertGymOwner,
  normalizeGender,
  membershipStatus,
  daysUntilExpiry,
  getActiveMembership,
  getOpenVisit,
  getOpenVisitsForUsers,
  removeGymMemberData,
  purgeGymMember,
  MEMBER_USER_SELECT,
  MEMBERSHIP_PLAN_SELECT,
  formatMemberRow,
  extractMemberAddress,
};
