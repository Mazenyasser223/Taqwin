/**
 * Gather user account data for GDPR-style export (PDF report).
 */
const { prisma } = require('../db');
const { findProfileByUserId } = require('./profile');

async function gatherAccountExportData(userId, role) {
  const [
    user,
    profile,
    settings,
    workoutLogs,
    foodLogs,
    orders,
    posts,
    tickets,
    notifications,
    gamification,
    achievements,
    follows,
    comments,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        phone: true,
        emailVerifiedAt: true,
        twoFactorEnabled: true,
        telegramLinkedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    findProfileByUserId(userId, role),
    prisma.userSettings.findUnique({ where: { userId } }),
    prisma.workoutLog.findMany({
      where: { userId },
      take: 500,
      orderBy: { loggedAt: 'desc' },
      include: { workout: { select: { title: true, category: true, durationMin: true } } },
    }),
    prisma.foodLog.findMany({
      where: { userId },
      take: 500,
      orderBy: { loggedAt: 'desc' },
    }),
    prisma.order.findMany({
      where: { userId },
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: { product: { select: { name: true, nameAr: true } } },
        },
      },
    }),
    prisma.communityPost.findMany({
      where: { authorId: userId },
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: { id: true, content: true, likesCount: true, createdAt: true },
    }),
    prisma.supportTicket.findMany({
      where: { userId },
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: { id: true, subject: true, category: true, status: true, createdAt: true },
    }),
    prisma.notification.findMany({
      where: { userId },
      take: 200,
      orderBy: { createdAt: 'desc' },
      select: {
        type: true,
        title: true,
        message: true,
        category: true,
        read: true,
        createdAt: true,
      },
    }),
    prisma.userGamification.findUnique({ where: { userId } }),
    prisma.userAchievement.findMany({
      where: { userId },
      take: 200,
      orderBy: { earnedAt: 'desc' },
    }),
    prisma.communityFollow.findMany({
      where: { OR: [{ followerId: userId }, { followingId: userId }] },
      take: 200,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.communityComment.findMany({
      where: { authorId: userId },
      take: 200,
      orderBy: { createdAt: 'desc' },
      select: { id: true, content: true, createdAt: true },
    }),
  ]);

  return {
    exportedAt: new Date(),
    user,
    profile,
    settings,
    workoutLogs,
    foodLogs,
    orders,
    communityPosts: posts,
    communityComments: comments,
    communityFollows: follows,
    notifications,
    gamification,
    achievements,
    supportTickets: tickets,
  };
}

module.exports = { gatherAccountExportData };
