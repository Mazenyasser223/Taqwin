/** Shared gym owner dashboard aggregations (keep DB round-trips minimal). */

const { normalizePlanBenefits } = require('./planBenefits');
const { loadClassSessionStats } = require('./gymClassSession');

const DAY_MS = 24 * 60 * 60 * 1000;

function summarizeMemberships(memberships, now, monthStart) {
  const isActiveMember = (m) => m.isActive && (!m.expiresAt || m.expiresAt > now);
  let activeMembers = 0;
  let newThisMonth = 0;
  let monthRevenue = 0;
  let paidThisMonthCount = 0;
  const planCounts = new Map();
  const memberCountByPlan = new Map();

  for (const m of memberships) {
    const active = isActiveMember(m);
    if (active) {
      activeMembers += 1;
      const label = m.plan?.name ?? 'No plan';
      planCounts.set(label, (planCounts.get(label) ?? 0) + 1);
      if (m.planId) {
        memberCountByPlan.set(m.planId, (memberCountByPlan.get(m.planId) ?? 0) + 1);
      }
    }
    if (m.joinedAt >= monthStart) newThisMonth += 1;
    if (m.paidAt && m.paidAt >= monthStart && m.paidAmount != null) {
      monthRevenue += m.paidAmount;
      paidThisMonthCount += 1;
    }
  }

  const planDistribution = [...planCounts.entries()].map(([name, value]) => ({ name, value }));
  const avgSubscriptionValue =
    paidThisMonthCount > 0 ? Math.round(monthRevenue / paidThisMonthCount) : 0;

  return {
    activeMembers,
    newThisMonth,
    monthRevenue: Math.round(monthRevenue),
    avgSubscriptionValue,
    planDistribution,
    memberCountByPlan,
  };
}

async function loadClassBookingRevenueSince(prisma, gymId, since) {
  const rows = await prisma.gymClassBooking.findMany({
    where: {
      gymId,
      status: { in: ['booked', 'attended', 'no_show'] },
      createdAt: { gte: since },
    },
    select: { paidAmount: true },
  });
  return rows.reduce((sum, row) => sum + (row.paidAmount || 0), 0);
}

async function loadGymDashboardCore(prisma, myGym, now = new Date()) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const weekAgo = new Date(now.getTime() - DAY_MS * 7);

  let classSessionStats = {
    totalBooked: 0,
    totalAttended: 0,
    totalNoShow: 0,
    totalAttendees: 0,
    totalRevenue: 0,
    sessions: [],
  };
  try {
    classSessionStats = await loadClassSessionStats(prisma, myGym.id);
  } catch (classStatsErr) {
    console.warn('[gymDashboard] class session stats skipped:', classStatsErr?.message);
  }

  const memberships = await prisma.gymMembership.findMany({
    where: { gymId: myGym.id },
    include: { plan: { select: { id: true, name: true, nameAr: true } } },
  });
  const plans = await prisma.gymSubscriptionPlan.findMany({
    where: { gymId: myGym.id },
    orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
  });

  const {
    activeMembers,
    newThisMonth,
    monthRevenue,
    avgSubscriptionValue,
    planDistribution,
    memberCountByPlan,
  } = summarizeMemberships(memberships, now, monthStart);

  const classMonthRevenue = await loadClassBookingRevenueSince(prisma, myGym.id, monthStart);

  const weekCheckIns = await prisma.gymCheckIn.count({
    where: { gymId: myGym.id, checkedInAt: { gte: weekAgo } },
  });

  const plansWithCounts = plans.map((p) => ({
    id: p.id,
    name: p.name,
    nameAr: p.nameAr,
    durationDays: p.durationDays,
    price: p.price,
    currency: p.currency,
    description: p.description,
    benefits: normalizePlanBenefits(p.benefits),
    isActive: p.isActive,
    sortOrder: p.sortOrder,
    memberCount: memberCountByPlan.get(p.id) ?? 0,
  }));

  return {
    hasGym: true,
    gym: { id: myGym.id, name: myGym.name, location: myGym.location },
    totals: {
      members: memberships.length,
      activeMembers,
      newThisMonth,
      weekCheckIns,
      capacity: myGym.maxCapacity,
      utilization: myGym.maxCapacity ? Math.round((activeMembers / myGym.maxCapacity) * 100) : 0,
      monthRevenue: Math.round(monthRevenue + classMonthRevenue),
      avgSubscriptionValue,
    },
    plans: plansWithCounts,
    planDistribution: planDistribution.length
      ? planDistribution
      : [
          { name: 'Active', value: activeMembers },
          { name: 'Inactive', value: memberships.length - activeMembers },
        ],
    classSessionStats,
    weekAgo,
  };
}

module.exports = { loadGymDashboardCore, summarizeMemberships, loadClassBookingRevenueSince, DAY_MS };
