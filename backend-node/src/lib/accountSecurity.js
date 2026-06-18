/**
 * Account security — session revocation, audit trail, pre-delete cleanup.
 */
const { prisma } = require('../db');
const { logger } = require('./logger');
const { unlinkTelegram } = require('./telegram/telegramLink');

function clientIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim().slice(0, 64);
  }
  return req?.ip || req?.socket?.remoteAddress || null;
}

async function revokeAllUserSessions(userId) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
    select: { tokenVersion: true },
  });
  return updated.tokenVersion;
}

async function recordAccountAudit({ userId, email, action, metadata, req }) {
  try {
    await prisma.accountAuditLog.create({
      data: {
        userId: userId || null,
        email: email || null,
        action,
        metadata: metadata || undefined,
        ipAddress: clientIp(req),
      },
    });
  } catch (err) {
    logger.warn({ err: err?.message, userId, action }, 'account audit log failed');
  }
}

async function cancelAllUserSubscriptions(userId) {
  const now = new Date();
  const result = await prisma.productSubscription.updateMany({
    where: { userId, status: { in: ['active', 'paused'] } },
    data: { status: 'cancelled', cancelledAt: now },
  });
  return result.count;
}

async function prepareAccountDeletion(userId, req) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, telegramChatId: true },
  });
  if (!user) return null;

  const subscriptionsCancelled = await cancelAllUserSubscriptions(userId);

  if (user.telegramChatId) {
    try {
      await unlinkTelegram(userId);
    } catch (err) {
      logger.warn({ err: err?.message, userId }, 'telegram unlink before delete failed');
    }
  }

  await recordAccountAudit({
    userId: user.id,
    email: user.email,
    action: 'account.delete.requested',
    metadata: { subscriptionsCancelled },
    req,
  });

  return { user, subscriptionsCancelled };
}

module.exports = {
  revokeAllUserSessions,
  recordAccountAudit,
  cancelAllUserSubscriptions,
  prepareAccountDeletion,
  clientIp,
};
