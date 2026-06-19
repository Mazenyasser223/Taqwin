/**
 * Send test in-app notifications and verify Telegram delivery.
 *
 * Usage:
 *   node scripts/test-telegram-notification.js
 *   node scripts/test-telegram-notification.js --email=user@example.com
 *   node scripts/test-telegram-notification.js --chat-id=123456789
 */
require('dotenv').config({ override: true });
const { prisma } = require('../src/db');
const { emitNotification } = require('../src/lib/notifications');
const { createTelegramLinkToken } = require('../src/lib/telegram/telegramLink');
const { getBotUsername } = require('../src/lib/telegram/telegramClient');
const { getNotificationHealth } = require('../src/lib/notifications/notificationHealth');

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : null;
}

const TEST_CASES = [
  {
    label: 'Coach feedback (critical)',
    type: 'coach.feedback_available',
    title: '🤖 المدرب الذكي راجع أسبوعك',
    message: 'تم تعديل برنامجك لزيادة فرص تحقيق هدفك. اضغط لمراجعة التعديلات.',
    link: '/dashboard?weeklyReview=1',
    priority: 'HIGH',
  },
  {
    label: 'Personal record',
    type: 'fitness.pr_achieved',
    title: '🏆 مبروك! رقم قياسي جديد',
    message: 'Bench Press — 100kg',
    link: '/dashboard',
    priority: 'HIGH',
  },
  {
    label: 'Support reply (critical)',
    type: 'support.reply',
    title: '📩 فريق الدعم رد على استفسارك',
    message: 'تم الرد على تذكرتك — افتح Taqwin للاطلاع.',
    link: '/support',
    priority: 'URGENT',
  },
  {
    label: 'Blocked: community reaction (in-app only)',
    type: 'community.reaction',
    title: 'Ahmed',
    message: 'liked your post (should NOT appear on Telegram)',
    link: '/community',
    expectTelegram: false,
  },
];

async function resolveUser() {
  const email = arg('email');
  const chatId = arg('chat-id');

  if (chatId) {
    const user = await prisma.user.findUnique({
      where: { telegramChatId: String(chatId) },
      select: { id: true, email: true, telegramChatId: true, telegramLinkedAt: true },
    });
    if (!user) throw new Error(`No user linked to chat-id ${chatId}`);
    return user;
  }

  if (email) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, telegramChatId: true, telegramLinkedAt: true },
    });
    if (!user) throw new Error(`User not found: ${email}`);
    return user;
  }

  const linked = await prisma.user.findFirst({
    where: { telegramChatId: { not: null } },
    orderBy: { telegramLinkedAt: 'desc' },
    select: { id: true, email: true, telegramChatId: true, telegramLinkedAt: true },
  });
  if (linked) return linked;

  const anyUser = await prisma.user.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, telegramChatId: true, telegramLinkedAt: true },
  });
  return anyUser;
}

async function main() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not set in backend-node/.env');
    process.exit(1);
  }

  const user = await resolveUser();
  if (!user) {
    console.error('No users in database.');
    process.exit(1);
  }

  console.log('\n=== Taqwin Telegram test ===\n');
  console.log(`User: ${user.email}`);
  console.log(`Linked: ${user.telegramChatId ? 'yes' : 'no'}`);
  if (user.telegramChatId) {
    console.log(`Chat ID: ${user.telegramChatId}`);
    console.log(`Linked at: ${user.telegramLinkedAt?.toISOString() || 'unknown'}`);
  } else {
    const link = await createTelegramLinkToken(user.id);
    console.log('\n⚠️  Account not linked to Telegram yet.');
    console.log('1. Open Taqwin → Settings → Telegram Alerts → Connect Telegram');
    console.log('   OR open this link and tap Start:\n');
    console.log(`   ${link.deepLink}\n`);
    console.log(`2. Re-run: node scripts/test-telegram-notification.js --email=${user.email}\n`);
    process.exit(0);
  }

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, telegramEnabled: true },
    update: { telegramEnabled: true },
  });

  console.log('\nSending test notifications (wait ~2s between each)...\n');

  for (const tc of TEST_CASES) {
    const dedupeKey = `${user.id}:telegram-test:${tc.type}`;
    const row = await emitNotification({
      userId: user.id,
      type: tc.type,
      link: tc.link,
      priority: tc.priority,
      dedupeKey,
      payload: { telegramTest: true },
    });

    if (!row) {
      console.log(`❌ ${tc.label} — in-app notification not created`);
    } else if (tc.expectTelegram === false) {
      console.log(`✅ ${tc.label} — in-app only (check Telegram: should be silent)`);
    } else {
      console.log(`✅ ${tc.label} — sent (check Telegram now)`);
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  const health = await getNotificationHealth();
  console.log('\n--- Health ---');
  console.log(JSON.stringify({
    telegramLinkedUsers: health.metrics.telegramLinkedUsers,
    telegramSentToday: health.metrics.telegramSentToday,
    telegramFailedToday: health.metrics.telegramFailedToday,
    telegramRateLimitedToday: health.metrics.telegramRateLimitedToday,
  }, null, 2));

  console.log(`\nBot: @${getBotUsername()}`);
  console.log('Done — check your Telegram chat.\n');
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
