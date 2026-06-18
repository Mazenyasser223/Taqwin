/**
 * Send every Telegram-eligible notification type to a linked user (demo / QA).
 * Copy is rendered via notificationTemplates using the user's language (or --lang=).
 *
 * Usage:
 *   node scripts/send-all-telegram-notifications.js
 *   node scripts/send-all-telegram-notifications.js --email=user@example.com
 *   node scripts/send-all-telegram-notifications.js --email=user@example.com --lang=en
 */
require('dotenv').config({ override: true });
const { prisma } = require('../src/db');
const { maybeSendTelegram } = require('../src/lib/telegram/telegramDelivery');
const { isBlockedType } = require('../src/lib/telegram/telegramTypeMap');
const { getNotificationHealth } = require('../src/lib/notifications/notificationHealth');
const { renderNotification } = require('../src/lib/notifications/notificationTemplates');
const { getOrCreateUserSettings } = require('../src/lib/userSettings');
const { getBotUsername } = require('../src/lib/telegram/telegramClient');

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : null;
}

const TELEGRAM_PREFS_ON = {
  telegramEnabled: true,
  telegramSecurityAlerts: true,
  telegramCoachAi: true,
  telegramFitnessAchievements: true,
  telegramOrders: true,
  telegramCommunityMessages: true,
  telegramGroupInvites: true,
  telegramFollowRequests: true,
  telegramSocialActivity: true,
  telegramMentions: true,
  telegramCommunityComments: true,
  telegramDailyDigest: true,
  telegramWeeklySummary: true,
  telegramMealReminders: true,
  telegramWorkoutMissed: true,
  telegramAiInsights: true,
};

/** Types without templates — localized demo fallback copy (rare). */
const DEMO_FALLBACK = {};

/** Demo payloads — rendered with renderNotification(type, payload, lang). */
const SEND_CASES = [
  { category: 'Security', type: 'auth.new_device', link: '/settings', priority: 'URGENT' },
  { category: 'Security', type: 'support.reply', link: '/support', priority: 'URGENT' },
  { category: 'Coach', type: 'coach.feedback_available', link: '/dashboard?weeklyReview=1', priority: 'HIGH' },
  { category: 'Coach', type: 'ai.adaptation_applied', link: '/dashboard' },
  { category: 'Coach', type: 'ai.adaptation_macro', link: '/nutrition' },
  {
    category: 'Coach',
    type: 'fitness.recovery_changed',
    link: '/dashboard',
    payload: { score: 58, previousScore: 76, delta: -18 },
    priority: 'HIGH',
  },
  { category: 'Coach', type: 'fitness.recovery_critical', link: '/dashboard', priority: 'URGENT' },
  { category: 'Coach', type: 'fitness.ai_insight', link: '/dashboard' },
  { category: 'Coach', type: 'fitness.weight_trend', link: '/dashboard' },
  { category: 'Coach', type: 'fitness.heart_rate_anomaly', link: '/dashboard' },
  {
    category: 'Achievements',
    type: 'fitness.pr_achieved',
    link: '/dashboard',
    priority: 'HIGH',
    payload: { exerciseName: 'Bench Press', value: '100kg' },
  },
  { category: 'Achievements', type: 'fitness.streak_milestone', link: '/dashboard', payload: { days: 30 } },
  { category: 'Achievements', type: 'gamification.challenge.completed', link: '/challenges' },
  { category: 'Achievements', type: 'gamification.duel.won', link: '/duels' },
  { category: 'Achievements', type: 'fitness.hydration_goal', link: '/dashboard' },
  { category: 'Achievements', type: 'fitness.macro_target', link: '/nutrition' },
  { category: 'Achievements', type: 'fitness.workout_missed', link: '/workouts' },
  { category: 'Digest', type: 'fitness.daily_digest', link: '/dashboard' },
  { category: 'Digest', type: 'fitness.weekly_summary', link: '/dashboard' },
  {
    category: 'Digest',
    type: 'plan.meal_reminder',
    link: '/nutrition',
    payload: { mealLabel: 'lunch' },
  },
  {
    category: 'Digest',
    type: 'workout.reminder',
    link: '/dashboard?reminder=workout',
    payload: { message: 'You have a workout scheduled today.' },
  },
  {
    category: 'Orders',
    type: 'order.placed',
    link: '/orders',
    payload: { variant: 'confirmed', total: '1,299', currency: 'EGP' },
  },
  { category: 'Orders', type: 'order.shipped', link: '/orders' },
  {
    category: 'Orders',
    type: 'order.awaiting_payment',
    link: '/checkout',
    priority: 'HIGH',
    payload: { total: '1,299', currency: 'EGP' },
  },
  { category: 'Community', type: 'community.message', link: '/messages' },
  { category: 'Community', type: 'community.group_invite', link: '/community/groups' },
  { category: 'Community', type: 'community.follow_request', link: '/community/follow-requests' },
  { category: 'Community', type: 'community.follow', link: '/community' },
  { category: 'Community', type: 'community.mention', link: '/community/post/1' },
  { category: 'Community', type: 'community.comment', link: '/community/post/1' },
  { category: 'Community', type: 'community.comment_reply', link: '/community/post/1' },
  { category: 'Community', type: 'community.message_request', link: '/messages/requests' },
  { category: 'Community', type: 'community.group_join_request', link: '/community/groups/admin' },
];

/** Per-locale demo fields (merged into payload at send time). */
const DEMO_LOCALE_PAYLOADS = {
  'fitness.ai_insight': {
    en: { exerciseName: 'Squat', percentChange: 12 },
    ar: { exerciseName: 'Squat', exerciseNameAr: 'السكوات', percentChange: 12 },
  },
  'fitness.weight_trend': {
    en: { deltaKg: -0.8, days: 14 },
    ar: { deltaKg: -0.8, days: 14 },
  },
  'fitness.daily_digest': {
    en: { summary: '3/5 workouts • 8,200 steps • 78% recovery' },
    ar: { summary: '٣/٥ تمارين • ٨٢٠٠ خطوة • ٧٨٪ تعافٍ' },
  },
  'fitness.weekly_summary': {
    en: { summary: '4 workouts • new PR • +1,200 kcal' },
    ar: { summary: '٤ تمارين • رقم قياسي • +١٢٠٠ سعرة' },
  },
  'fitness.workout_missed': {
    en: { workoutName: 'Push Day' },
    ar: { workoutNameAr: 'يوم الدفع' },
  },
  'support.reply': {
    en: { subject: 'Account help' },
    ar: { subjectAr: 'مساعدة الحساب' },
  },
  'community.message': {
    en: { actorName: 'Alex', preview: 'Hey! Did you train today?' },
    ar: { actorName: 'أحمد', preview: 'مرحباً! هل تمرّنت اليوم؟' },
  },
  'community.group_invite': {
    en: { actorName: 'Sara', groupName: 'Taqwin Cairo Team' },
    ar: { actorName: 'سارة', groupName: 'فريق تكوين القاهرة' },
  },
  'community.follow_request': {
    en: { actorName: 'Mike' },
    ar: { actorName: 'محمد' },
  },
  'community.follow': {
    en: { actorName: 'Fatima' },
    ar: { actorName: 'فاطمة' },
  },
  'community.mention': {
    en: { actorName: 'Ali' },
    ar: { actorName: 'علي' },
  },
  'community.comment': {
    en: { actorName: 'Youssef', preview: 'Great progress!' },
    ar: { actorName: 'يوسف', preview: 'تقدّم رائع!' },
  },
  'community.comment_reply': {
    en: { actorName: 'Nour' },
    ar: { actorName: 'نور' },
  },
  'community.message_request': {
    en: { actorName: 'Chris' },
    ar: { actorName: 'كريم' },
  },
  'community.group_join_request': {
    en: { actorName: 'Layla', groupName: 'Your group' },
    ar: { actorName: 'ليلى', groupName: 'مجموعتك' },
  },
  'gamification.challenge.completed': {
    en: { title: '10,000 steps', xp: 150 },
    ar: { title: '١٠٠٠٠ خطوة', xp: 150 },
  },
  'gamification.duel.won': {
    en: { title: 'Weekly steps duel', xp: 200 },
    ar: { title: 'تحدي خطوات الأسبوع', xp: 200 },
  },
};

const BLOCKED_SAMPLES = [
  'community.reaction',
  'community.like',
  'community.ring',
  'promo.sale',
  'gamification.xp_gained',
];

function resolveLang(settings) {
  const langArg = arg('lang');
  if (langArg === 'ar' || langArg === 'en') return langArg;
  return settings?.language === 'ar' ? 'ar' : 'en';
}

function buildDemoRow(tc, lang) {
  const localePayload = DEMO_LOCALE_PAYLOADS[tc.type]?.[lang] || {};
  const payload = { telegramDemo: true, copyLocale: lang, ...(tc.payload || {}), ...localePayload };
  let rendered = renderNotification(tc.type, payload, lang);
  const fallback = DEMO_FALLBACK[tc.type]?.[lang] || DEMO_FALLBACK[tc.type]?.en;
  if (fallback && (!rendered.message || rendered.title === tc.type)) {
    rendered = fallback;
  }
  return {
    id: `demo-${tc.type}`,
    type: tc.type,
    title: rendered.title,
    message: rendered.message,
    link: tc.link,
    priority: tc.priority,
    payload,
  };
}

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
  throw new Error('No linked Telegram user found. Pass --email= or link via Settings.');
}

async function main() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not set in backend-node/.env');
    process.exit(1);
  }

  const user = await resolveUser();
  if (!user.telegramChatId) {
    console.error(`User ${user.email} is not linked to Telegram.`);
    process.exit(1);
  }

  const settings = await getOrCreateUserSettings(user.id);
  const lang = resolveLang(settings);

  console.log('\n=== Taqwin — all Telegram notification types ===\n');
  console.log(`User: ${user.email}`);
  console.log(`Chat ID: ${user.telegramChatId}`);
  console.log(`Language: ${lang}`);
  console.log(`Sending ${SEND_CASES.length} messages (~1.5s apart)...\n`);

  const loadCtx = async () => ({
    user: { telegramChatId: user.telegramChatId, telegramLinkedAt: user.telegramLinkedAt },
    settings: { ...settings, ...TELEGRAM_PREFS_ON, language: lang },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const tc of SEND_CASES) {
    const row = buildDemoRow(tc, lang);

    const result = await maybeSendTelegram(user.id, row, {
      loadTelegramContext: loadCtx,
    });

    if (result.sent) {
      sent += 1;
      console.log(`✅ [${tc.category}] ${tc.type}`);
    } else if (result.skipped) {
      skipped += 1;
      console.log(`⏭️  [${tc.category}] ${tc.type} — ${result.reason}`);
    } else {
      failed += 1;
      console.log(`❌ [${tc.category}] ${tc.type} — ${result.reason || result.error}`);
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log('\n--- In-app only (blocked on Telegram) ---');
  for (const type of BLOCKED_SAMPLES) {
    console.log(`   🚫 ${type}${isBlockedType(type) ? '' : ' (unexpected: not blocked)'}`);
  }

  const health = await getNotificationHealth();
  console.log('\n--- Summary ---');
  console.log(`Sent: ${sent} | Skipped: ${skipped} | Failed: ${failed}`);
  console.log(JSON.stringify({
    telegramSentToday: health.metrics.telegramSentToday,
    telegramFailedToday: health.metrics.telegramFailedToday,
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
