/**
 * Gym subscription plan helpers — expiry from duration, membership payload.
 */
const { prisma } = require('../db');

function addDays(from, days) {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function computeExpiresAt(durationDays, from = new Date()) {
  if (!durationDays || durationDays <= 0) return null;
  return addDays(from, durationDays);
}

async function loadGymPlan(gymId, planId) {
  if (!planId) return null;
  const plan = await prisma.gymSubscriptionPlan.findFirst({
    where: { id: planId, gymId, isActive: true },
  });
  if (!plan) {
    const err = new Error('Subscription plan not found');
    err.status = 404;
    throw err;
  }
  return plan;
}

/**
 * Build membership create/update fields from optional plan + payment input.
 * @param {{ planId?: string, expiresAt?: string|null, paidAmount?: number|null, paymentMethod?: string|null }} input
 */
async function resolveMembershipPlanFields(gymId, input = {}) {
  const { planId, expiresAt, paidAmount, paymentMethod } = input;
  const now = new Date();
  const fields = {};

  if (planId) {
    const plan = await loadGymPlan(gymId, planId);
    fields.planId = plan.id;
    fields.expiresAt = expiresAt ? new Date(expiresAt) : computeExpiresAt(plan.durationDays, now);
    if (paidAmount != null) {
      fields.paidAmount = paidAmount;
      fields.paidAt = now;
    } else {
      fields.paidAmount = plan.price;
      fields.paidAt = now;
    }
    if (paymentMethod) fields.paymentMethod = paymentMethod;
  } else if (expiresAt !== undefined) {
    fields.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (paidAmount != null) {
      fields.paidAmount = paidAmount;
      fields.paidAt = now;
    }
    if (paymentMethod) fields.paymentMethod = paymentMethod;
  } else if (paidAmount != null || paymentMethod) {
    if (paidAmount != null) {
      fields.paidAmount = paidAmount;
      fields.paidAt = now;
    }
    if (paymentMethod) fields.paymentMethod = paymentMethod;
  }

  return fields;
}

const { normalizePlanBenefits } = require('./planBenefits');

function formatPlanRow(plan, memberCount = 0) {
  return {
    id: plan.id,
    gymId: plan.gymId,
    name: plan.name,
    nameAr: plan.nameAr,
    durationDays: plan.durationDays,
    price: plan.price,
    currency: plan.currency,
    description: plan.description,
    benefits: normalizePlanBenefits(plan.benefits),
    isActive: plan.isActive,
    sortOrder: plan.sortOrder,
    memberCount,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

module.exports = {
  addDays,
  computeExpiresAt,
  loadGymPlan,
  resolveMembershipPlanFields,
  formatPlanRow,
};
