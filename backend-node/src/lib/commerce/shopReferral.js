/**
 * Referral program — invite friend, get 100 points on first paid order.
 */
const { randomBytes } = require('crypto');
const { prisma } = require('../../db');
const { emitNotification } = require('../notifications');

const REFERRAL_BONUS_POINTS = Number(process.env.SHOP_REFERRAL_BONUS_POINTS) || 100;

function generateReferralCode(userId) {
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return `TQ${String(userId).slice(0, 4).toUpperCase()}${suffix}`;
}

async function getOrCreateReferralCode(userId) {
  const existing = await prisma.referralCode.findUnique({ where: { userId } });
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateReferralCode(userId);
    try {
      return await prisma.referralCode.create({ data: { userId, code } });
    } catch {
      /* collision */
    }
  }
  const err = new Error('Could not generate referral code');
  err.status = 500;
  throw err;
}

async function recordReferralSignup(referrerCode, refereeId, refereeEmail) {
  const codeRow = await prisma.referralCode.findUnique({ where: { code: String(referrerCode).trim().toUpperCase() } });
  if (!codeRow || codeRow.userId === refereeId) return null;

  const existing = await prisma.referralInvite.findUnique({ where: { refereeId } });
  if (existing) return existing;

  return prisma.referralInvite.create({
    data: {
      referrerId: codeRow.userId,
      refereeId,
      refereeEmail: refereeEmail || null,
      status: 'pending',
    },
  });
}

async function completeReferralOnFirstPaidOrder(refereeId, orderId) {
  const invite = await prisma.referralInvite.findUnique({ where: { refereeId } });
  if (!invite || invite.status === 'completed') return null;

  const paidBefore = await prisma.order.count({
    where: {
      userId: refereeId,
      paymentStatus: 'paid',
      id: { not: orderId },
    },
  });
  if (paidBefore > 0) return null;

  await prisma.$transaction([
    prisma.referralInvite.update({
      where: { id: invite.id },
      data: { status: 'completed', completedAt: new Date(), pointsAwarded: REFERRAL_BONUS_POINTS },
    }),
    prisma.loyaltyAccount.upsert({
      where: { userId: invite.referrerId },
      create: {
        userId: invite.referrerId,
        points: REFERRAL_BONUS_POINTS,
        lifetimePoints: REFERRAL_BONUS_POINTS,
      },
      update: {
        points: { increment: REFERRAL_BONUS_POINTS },
        lifetimePoints: { increment: REFERRAL_BONUS_POINTS },
      },
    }),
    prisma.loyaltyTransaction.create({
      data: {
        userId: invite.referrerId,
        points: REFERRAL_BONUS_POINTS,
        type: 'referral_bonus',
        orderId,
        note: `Referral bonus — friend first order`,
      },
    }),
  ]);

  void emitNotification({
    userId: invite.referrerId,
    type: 'promo.referral_reward',
    link: '/marketplace',
    payload: { points: REFERRAL_BONUS_POINTS },
  });

  return { referrerId: invite.referrerId, points: REFERRAL_BONUS_POINTS };
}

async function getReferralSummary(userId) {
  const code = await getOrCreateReferralCode(userId);
  const invites = await prisma.referralInvite.findMany({
    where: { referrerId: userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  const completed = invites.filter((i) => i.status === 'completed').length;
  return {
    code: code.code,
    inviteLink: `/signup?ref=${encodeURIComponent(code.code)}`,
    totalInvites: invites.length,
    completedInvites: completed,
    pointsEarned: completed * REFERRAL_BONUS_POINTS,
    invites,
  };
}

module.exports = {
  getOrCreateReferralCode,
  recordReferralSignup,
  completeReferralOnFirstPaidOrder,
  getReferralSummary,
  REFERRAL_BONUS_POINTS,
};
