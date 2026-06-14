/**
 * Community recommendation feed seed — synthetic users, follows, rings, gyms, posts.
 * Run: npm run db:seed:community
 * Re-run: npm run db:seed:community:force
 *
 * Test as demo@taqwin.app / Taqwin#2025 — open Community → For you.
 */
const { PrismaClient, Role } = require('../generated/prisma');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const PASSWORD = 'Taqwin#2025';
const DEMO_EMAIL = 'demo@taqwin.app';
const SEED_EMAIL_PREFIX = 'recfeed.';
const META_KEY = 'community_recommendation_seeded_v1';

const META_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS _meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

function hoursAgo(h) {
  return new Date(Date.now() - h * 3_600_000);
}

function daysAgo(d) {
  return hoursAgo(d * 24);
}

async function isSeeded(force) {
  await prisma.$executeRawUnsafe(META_TABLE_SQL);
  if (force) return false;
  const rows = await prisma.$queryRawUnsafe('SELECT value FROM _meta WHERE key = $1 LIMIT 1', META_KEY);
  return Array.isArray(rows) && rows.length > 0;
}

async function markSeeded() {
  await prisma.$executeRawUnsafe(
    `INSERT INTO _meta (key, value) VALUES ($1, NOW()::text)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();`,
    META_KEY,
  );
}

async function wipeRecfeedData() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: SEED_EMAIL_PREFIX } },
    select: { id: true },
  });
  if (!users.length) return;
  const ids = users.map((u) => u.id);
  console.log(`[community-seed] removing ${ids.length} previous recfeed users...`);
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

async function upsertPasswordUser({ email, role, displayName, fitnessGoal, fitnessLevel }) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { role },
    create: {
      email,
      role,
      passwordHash,
      emailVerifiedAt: new Date(),
      athleteProfile: {
        create: {
          displayName,
          fitnessGoal: fitnessGoal ?? 'General Fitness',
          fitnessLevel: fitnessLevel ?? 'Intermediate',
        },
      },
    },
    include: { athleteProfile: true },
  });
  if (!user.athleteProfile) {
    await prisma.athleteProfile.upsert({
      where: { userId: user.id },
      update: { displayName, fitnessGoal, fitnessLevel },
      create: {
        userId: user.id,
        displayName,
        fitnessGoal: fitnessGoal ?? 'General Fitness',
        fitnessLevel: fitnessLevel ?? 'Intermediate',
      },
    });
  } else {
    await prisma.athleteProfile.update({
      where: { userId: user.id },
      data: { displayName, fitnessGoal, fitnessLevel },
    });
  }
  return user;
}

async function upsertCoachUser({ email, displayName }) {
  return upsertPasswordUser({
    email,
    role: Role.athlete,
    displayName,
    fitnessGoal: 'Coaching',
    fitnessLevel: 'Advanced',
  });
}

async function ensurePublicProfile(userId) {
  await prisma.userSettings.upsert({
    where: { userId },
    update: { publicProfile: true },
    create: { userId, publicProfile: true },
  });
}

async function ensureMembership(gymId, userId) {
  await prisma.gymMembership.upsert({
    where: { gymId_userId: { gymId, userId } },
    update: { isActive: true },
    create: { gymId, userId, isActive: true },
  });
}

async function ensureFollow(followerId, followingId) {
  if (followerId === followingId) return;
  await prisma.communityFollow.upsert({
    where: { followerId_followingId: { followerId, followingId } },
    update: { status: 'accepted' },
    create: { followerId, followingId, status: 'accepted' },
  });
}

async function ensureRing(subscriberId, targetUserId) {
  if (subscriberId === targetUserId) return;
  await prisma.communityPostRing.upsert({
    where: { subscriberId_targetUserId: { subscriberId, targetUserId } },
    update: {},
    create: { subscriberId, targetUserId },
  });
}

async function createFeedPost({
  authorId,
  content,
  createdAt,
  likesCount = 0,
  repostsCount = 0,
  gymId = null,
  taggedUserId = null,
  likeFromUserIds = [],
}) {
  const post = await prisma.communityPost.create({
    data: {
      authorId,
      content,
      createdAt,
      likesCount,
      repostsCount,
      visibility: 'everyone',
      ...(gymId
        ? {
            gymMentions: {
              create: { gymId },
            },
          }
        : {}),
      ...(taggedUserId
        ? {
            tags: {
              create: { taggedUserId },
            },
          }
        : {}),
    },
  });

  for (const uid of likeFromUserIds.slice(0, Math.min(5, likesCount))) {
    try {
      await prisma.communityPostLike.create({
        data: { postId: post.id, userId: uid, emoji: 'like' },
      });
    } catch {
      /* duplicate */
    }
  }

  if (likesCount > 0) {
    await prisma.communityPost.update({
      where: { id: post.id },
      data: { likesCount, repostsCount },
    });
  }

  const commentCount = Math.min(2, Math.floor(likesCount / 15));
  for (let i = 0; i < commentCount; i++) {
    const commenter = likeFromUserIds[i % likeFromUserIds.length];
    if (!commenter || commenter === authorId) continue;
    await prisma.communityComment.create({
      data: {
        postId: post.id,
        authorId: commenter,
        content: ['Great work!', 'Inspired — trying this tomorrow.', 'Beast mode 🔥'][i % 3],
        createdAt,
      },
    });
  }

  return post;
}

async function seed({ force = false } = {}) {
  if (await isSeeded(force)) {
    console.log('[community-seed] already seeded. Use --force to rebuild recfeed data.');
    return;
  }

  if (force) await wipeRecfeedData();

  const demo = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!demo) {
    throw new Error(`Demo user ${DEMO_EMAIL} not found. Run npm run db:seed first.`);
  }

  const gyms = await prisma.gym.findMany({ orderBy: { createdAt: 'asc' }, take: 3 });
  if (!gyms.length) {
    throw new Error('No gyms found. Run npm run db:seed first.');
  }
  const ironHouse = gyms[0];
  const pulse = gyms[1] ?? gyms[0];
  const flow = gyms[2] ?? gyms[0];

  console.log('[community-seed] creating synthetic users...');

  const athletes = [];
  const athleteDefs = [
    { n: '01', name: 'Omar Hassan', goal: 'Build Strength', level: 'Intermediate' },
    { n: '02', name: 'Lina Farouk', goal: 'Fat Loss', level: 'Beginner' },
    { n: '03', name: 'Youssef Ali', goal: 'Endurance', level: 'Advanced' },
    { n: '04', name: 'Nadia Saleh', goal: 'Recomposition', level: 'Intermediate' },
    { n: '05', name: 'Hadi Mahmoud', goal: 'Build Strength', level: 'Beginner' },
    { n: '06', name: 'Sara Nabil', goal: 'General Fitness', level: 'Intermediate' },
    { n: '07', name: 'Tarek Fawzy', goal: 'Endurance', level: 'Intermediate' },
    { n: '08', name: 'Mariam Adel', goal: 'Fat Loss', level: 'Advanced' },
    { n: '09', name: 'Ziad Khaled', goal: 'Build Strength', level: 'Intermediate' },
    { n: '10', name: 'Rana Hisham', goal: 'Recomposition', level: 'Beginner' },
    { n: '11', name: 'Karim Soliman', goal: 'Endurance', level: 'Intermediate' },
    { n: '12', name: 'Dina Mostafa', goal: 'General Fitness', level: 'Beginner' },
    { n: '13', name: 'Amir Lotfy', goal: 'Build Strength', level: 'Advanced' },
    { n: '14', name: 'Hana Youssef', goal: 'Fat Loss', level: 'Intermediate' },
    { n: '15', name: 'Fares Emad', goal: 'Endurance', level: 'Beginner' },
  ];

  for (const a of athleteDefs) {
    const u = await upsertPasswordUser({
      email: `${SEED_EMAIL_PREFIX}athlete${a.n}@taqwin.app`,
      role: Role.athlete,
      displayName: a.name,
      fitnessGoal: a.goal,
      fitnessLevel: a.level,
    });
    await ensurePublicProfile(u.id);
    athletes.push(u);
  }

  const coaches = [];
  for (const [i, name] of [
    ['Coach Maya', 'Coach Maya El-Sayed'],
    ['Coach Samir', 'Coach Samir Nader'],
    ['Coach Leila', 'Coach Leila Osman'],
  ].entries()) {
    const u = await upsertCoachUser({
      email: `${SEED_EMAIL_PREFIX}coach${String(i + 1).padStart(2, '0')}@taqwin.app`,
      displayName: name[1],
    });
    await ensurePublicProfile(u.id);
    coaches.push(u);
  }

  const allSynthetic = [...athletes, ...coaches];
  const likerPool = allSynthetic.map((u) => u.id);

  console.log('[community-seed] gym memberships...');
  await ensureMembership(ironHouse.id, demo.id);
  for (const a of athletes.slice(0, 8)) await ensureMembership(ironHouse.id, a.id);
  for (const a of athletes.slice(8, 12)) await ensureMembership(pulse.id, a.id);
  for (const a of athletes.slice(12)) await ensureMembership(flow.id, a.id);
  for (const c of coaches) await ensureMembership(ironHouse.id, c.id);

  await ensurePublicProfile(demo.id);

  console.log('[community-seed] social graph for demo viewer...');
  const followed = [athletes[0], athletes[1], athletes[2], coaches[0], coaches[1]];
  const ringed = [athletes[1], coaches[0]];
  const mutual = [athletes[0], athletes[1], athletes[2]];

  for (const u of followed) await ensureFollow(demo.id, u.id);
  for (const u of ringed) await ensureRing(demo.id, u.id);
  for (const u of mutual) await ensureFollow(u.id, demo.id);

  // Extra follows between synthetic users (engagement graph)
  await ensureFollow(athletes[3].id, athletes[0].id);
  await ensureFollow(athletes[4].id, coaches[0].id);
  await ensureFollow(athletes[5].id, athletes[1].id);

  console.log('[community-seed] creating posts...');
  let postCount = 0;

  const postTemplates = {
    workout: [
      'Leg day complete — 5x5 squats felt solid.',
      'Morning run done before the heat. 8km easy pace.',
      'Hit a new bench PR today. Small wins matter.',
      'Pull day: deadlifts + rows. Grip is cooked.',
      'Core and mobility session — hips feel much better.',
    ],
    gym: [
      'Great energy at the gym this morning — who else trained early?',
      'New squat racks are in — come check them out.',
      'Member spotlight: consistency beats intensity every time.',
      'Weekend warrior session — full body circuit.',
    ],
    coach: [
      'Form tip: brace your core before every heavy lift.',
      'Recovery is training. Sleep 7+ hours this week.',
      'Client PR alert — proud of the progress this block.',
      'Try this finisher: 3 rounds of 12 KB swings + 10 push-ups.',
    ],
    discovery: [
      'First week on Taqwin — loving the community vibe.',
      'Meal prep Sunday is done. High protein all week.',
      'Anyone training for a 10K this fall?',
      'Stretching routine that saved my lower back — happy to share.',
    ],
  };

  async function seedAuthorPosts(author, lines, opts = {}) {
    const {
      count = 4,
      maxHours = 72,
      minHours = 2,
      likes = 0,
      reposts = 0,
      gymId = null,
      tagDemo = false,
    } = opts;
    for (let i = 0; i < count; i++) {
      const hours = minHours + Math.floor((maxHours - minHours) * (i / Math.max(1, count - 1)));
      await createFeedPost({
        authorId: author.id,
        content: lines[i % lines.length],
        createdAt: hoursAgo(hours),
        likesCount: likes + (i % 3) * 4,
        repostsCount: reposts + (i % 2),
        gymId: gymId && i % 2 === 0 ? gymId : null,
        taggedUserId: tagDemo && i === 0 ? demo.id : null,
        likeFromUserIds: likerPool,
      });
      postCount += 1;
    }
  }

  // HIGH: followed + ringed — should rank at top for demo
  await seedAuthorPosts(athletes[1], postTemplates.workout, { count: 6, maxHours: 18, likes: 12, reposts: 2 });
  await seedAuthorPosts(coaches[0], postTemplates.coach, { count: 6, maxHours: 20, likes: 18, reposts: 3 });
  await seedAuthorPosts(athletes[0], postTemplates.workout, { count: 5, maxHours: 30, likes: 8, reposts: 1 });

  // Followed but not ringed
  await seedAuthorPosts(athletes[2], postTemplates.workout, { count: 4, maxHours: 40, likes: 6 });
  await seedAuthorPosts(coaches[1], postTemplates.coach, { count: 4, maxHours: 48, likes: 10 });

  // Same gym (Iron House) — demo does NOT follow these
  await seedAuthorPosts(athletes[3], postTemplates.gym, {
    count: 5,
    maxHours: 36,
    likes: 5,
    gymId: ironHouse.id,
  });
  await seedAuthorPosts(athletes[4], postTemplates.workout, {
    count: 4,
    maxHours: 50,
    likes: 7,
    gymId: ironHouse.id,
  });
  await seedAuthorPosts(athletes[5], postTemplates.gym, { count: 3, maxHours: 60, gymId: ironHouse.id });

  // Trending — high engagement, not in social graph
  await seedAuthorPosts(athletes[12], postTemplates.workout, {
    count: 3,
    maxHours: 120,
    likes: 45,
    reposts: 12,
  });
  await seedAuthorPosts(athletes[13], postTemplates.discovery, {
    count: 3,
    maxHours: 96,
    likes: 38,
    reposts: 8,
  });
  await seedAuthorPosts(athletes[14], postTemplates.workout, {
    count: 2,
    maxHours: 80,
    likes: 52,
    reposts: 15,
  });

  // @mention demo explicitly
  await createFeedPost({
    authorId: athletes[6].id,
    content: `@Demo Athlete thanks for the spot on squats yesterday!`,
    createdAt: hoursAgo(8),
    likesCount: 6,
    taggedUserId: demo.id,
    likeFromUserIds: likerPool,
  });
  postCount += 1;

  await createFeedPost({
    authorId: coaches[2].id,
    content: 'Shoutout to everyone at Iron House — community training tonight 6pm.',
    createdAt: hoursAgo(5),
    likesCount: 14,
    gymId: ironHouse.id,
    taggedUserId: demo.id,
    likeFromUserIds: likerPool,
  });
  postCount += 1;

  // Discovery — old, low engagement
  for (const a of athletes.slice(9, 12)) {
    await seedAuthorPosts(a, postTemplates.discovery, {
      count: 2,
      minHours: 120,
      maxHours: 280,
      likes: 1,
    });
  }

  // Pulse gym only (different gym from demo's secondary membership)
  await seedAuthorPosts(athletes[9], postTemplates.gym, {
    count: 3,
    maxHours: 45,
    likes: 4,
    gymId: pulse.id,
  });

  // Gym owner posts
  if (ironHouse.ownerId) {
    await createFeedPost({
      authorId: ironHouse.ownerId,
      content: 'Iron House summer challenge starts Monday — prizes for most check-ins!',
      createdAt: hoursAgo(12),
      likesCount: 22,
      repostsCount: 5,
      gymId: ironHouse.id,
      likeFromUserIds: likerPool,
    });
    postCount += 1;
  }

  await markSeeded();

  console.log('[community-seed] done.');
  console.log(`  Posts created: ~${postCount}`);
  console.log(`  Test login: ${DEMO_EMAIL} / ${PASSWORD}`);
  console.log('  Open Community → For you (compare with Following / Trending).');
  console.log('');
  console.log('  Expected For You ranking for demo:');
  console.log('    1. Lina Farouk + Coach Maya (ringed + followed) — newest first');
  console.log('    2. Omar Hassan (followed + mutual)');
  console.log('    3. Same-gym posts (Nadia, Hadi, Sara at Iron House)');
  console.log('    4. High-like trending (Amir, Hana, Fares)');
  console.log('    5. Discovery / older low-engagement posts');
}

const force = process.argv.includes('--force');
seed({ force })
  .catch((err) => {
    console.error('[community-seed] error', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
