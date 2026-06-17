import type { GymMembership, MembershipStatus, ReceptionGender, ReceptionMemberDetail, ReceptionPresentMember } from '../types';

function membershipStatus(m: GymMembership, now = new Date()): MembershipStatus {
  if (!m.isActive) return 'inactive';
  if (m.expiresAt && new Date(m.expiresAt) < now) return 'expired';
  return 'active';
}

function daysUntilExpiry(expiresAt?: string | null, now = new Date()): number | null {
  if (!expiresAt) return null;
  const end = new Date(expiresAt);
  end.setHours(23, 59, 59, 999);
  return Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

function normalizeGender(raw?: string | null): ReceptionGender {
  if (!raw) return 'unknown';
  const s = String(raw).trim().toLowerCase();
  if (['male', 'm', 'man', 'ذكر'].includes(s)) return 'male';
  if (['female', 'f', 'woman', 'أنثى', 'انثى'].includes(s)) return 'female';
  return 'unknown';
}

function extractAddress(profile: { onboardingData?: unknown } | null | undefined): string | null {
  const data = profile?.onboardingData;
  if (data && typeof data === 'object' && !Array.isArray(data) && typeof (data as { address?: unknown }).address === 'string') {
    return (data as { address: string }).address;
  }
  return null;
}

/** Include present-only visitors missing from the membership roster. */
export function mergePresentOnlyMembers(
  members: ReceptionMemberDetail[],
  present: ReceptionPresentMember[],
): ReceptionMemberDetail[] {
  const byUserId = new Map(members.map((m) => [m.userId, m]));
  for (const p of present) {
    if (byUserId.has(p.userId)) continue;
    byUserId.set(p.userId, {
      membershipId: '',
      userId: p.userId,
      planId: null,
      plan: null,
      paidAmount: null,
      paymentMethod: null,
      paidAt: null,
      joinedAt: p.checkedInAt,
      expiresAt: null,
      isActive: false,
      membershipStatus: 'inactive',
      daysRemaining: null,
      isPresent: true,
      checkedInAt: p.checkedInAt,
      visitId: p.visitId,
      gender: p.gender,
      address: null,
      user: p.user,
    });
  }
  return Array.from(byUserId.values());
}

/** Build reception roster rows from gym members + optional present list (fallback when /reception/members fails). */
export function buildReceptionMembersFromGymMemberships(
  memberships: GymMembership[],
  present: ReceptionPresentMember[] = [],
): ReceptionMemberDetail[] {
  const presentByUser = new Map(present.map((p) => [p.userId, p]));
  const now = new Date();

  return memberships
    .filter((m) => m.user)
    .map((m) => {
      const open = presentByUser.get(m.userId);
      const user = m.user!;
      return {
        membershipId: m.id,
        userId: m.userId,
        planId: m.planId ?? null,
        plan: m.plan ?? null,
        paidAmount: m.paidAmount ?? null,
        paymentMethod: m.paymentMethod ?? null,
        paidAt: m.paidAt ?? null,
        joinedAt: m.joinedAt,
        expiresAt: m.expiresAt ?? null,
        isActive: m.isActive,
        accountCreatedAtDesk: m.accountCreatedAtDesk ?? false,
        membershipStatus: membershipStatus(m, now),
        daysRemaining: daysUntilExpiry(m.expiresAt, now),
        isPresent: Boolean(open),
        checkedInAt: open?.checkedInAt ?? null,
        visitId: open?.visitId ?? null,
        gender: open?.gender ?? normalizeGender(user.profile?.gender),
        address: m.address ?? extractAddress(user.profile as { onboardingData?: unknown } | null | undefined),
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone ?? null,
          profile: user.profile ?? null,
        },
      };
    });
}
