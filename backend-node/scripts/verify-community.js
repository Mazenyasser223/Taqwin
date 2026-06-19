#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Verify community feed API + DB (reproducible across machines).
 *
 * Usage:
 *   npm run verify:community
 *   VERIFY_COMMUNITY_EMAIL=you@email.com node scripts/verify-community.js
 *
 * Requires backend on PORT (default 4000) and DATABASE_URL.
 */
require('dotenv').config({ override: true });

const http = require('http');
const jwt = require('jsonwebtoken');
const { prisma } = require('../src/db');

const PORT = Number(process.env.PORT || 4000);
const BASE = `http://127.0.0.1:${PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || 'taqwin-dev-secret-change-in-production-min-32-chars';
const VIEWER_EMAIL = (
  process.env.VERIFY_COMMUNITY_EMAIL ||
  process.env.COMMUNITY_SEED_VIEWER_EMAIL ||
  'demo@taqwin.app'
)
  .trim()
  .toLowerCase();

function request(path, token, { method = 'GET', body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      `${BASE}${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = data ? JSON.parse(data) : null;
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed, raw: data, ms: Date.now() - started });
        });
      },
    );
    const started = Date.now();
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function assertOk(label, res, { minStatus = 200, maxStatus = 299 } = {}) {
  if (res.status < minStatus || res.status > maxStatus) {
    const detail =
      typeof res.body === 'object' ? JSON.stringify(res.body).slice(0, 400) : String(res.raw).slice(0, 400);
    throw new Error(`${label}: HTTP ${res.status} — ${detail}`);
  }
  console.log(`  ✓ ${label} (${res.status}, ${res.ms}ms)`);
  return res.body;
}

async function timed(label, fn) {
  const start = Date.now();
  const result = await fn();
  console.log(`  ✓ ${label} (${Date.now() - start}ms)`);
  return result;
}

async function main() {
  console.log(`[verify-community] viewer=${VIEWER_EMAIL} api=${BASE}`);

  const user = await prisma.user.findUnique({
    where: { email: VIEWER_EMAIL },
    select: { id: true, email: true, role: true },
  });
  if (!user) {
    throw new Error(
      `User not found: ${VIEWER_EMAIL}. Run: npm run seed:community or npm run setup:community`,
    );
  }

  const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: '1h',
  });

  console.log('\n— Feed tabs —');
  for (const feed of ['for_you', 'following', 'athletes', 'gyms', 'trending']) {
    const body = assertOk(`GET /posts?feed=${feed}`, await request(`/api/community/posts?feed=${feed}`, token));
    const posts = Array.isArray(body) ? body : body?.posts;
    if (!Array.isArray(posts)) {
      throw new Error(`Feed ${feed}: expected array, got ${typeof body}`);
    }
  }

  console.log('\n— Stories —');
  assertOk('GET /stories/feed', await request('/api/community/stories/feed', token));

  console.log('\n— DB counts —');
  const [postCount, storyCount, followCount] = await timed('DB aggregate', () =>
    Promise.all([
      prisma.communityPost.count(),
      prisma.communityStory.count({ where: { expiresAt: { gt: new Date() } } }),
      prisma.communityFollow.count({ where: { status: 'accepted' } }),
    ]),
  );
  console.log(`    posts=${postCount} activeStories=${storyCount} follows=${followCount}`);

  if (postCount === 0) {
    console.warn('\n  ⚠ No posts in DB — run: npm run seed:community');
  }

  console.log('\n— Create + delete smoke post —');
  const created = assertOk(
    'POST /posts',
    await request('/api/community/posts', token, {
      method: 'POST',
      body: { content: `[verify-community] smoke test ${new Date().toISOString()}` },
    }),
    { minStatus: 201, maxStatus: 201 },
  );
  if (!created?.id) throw new Error('Create post: missing id');

  const fetched = assertOk(
    `GET /posts/${created.id}`,
    await request(`/api/community/posts/${created.id}`, token),
  );
  if (fetched.id !== created.id) throw new Error('Fetched post id mismatch');

  assertOk(
    `DELETE /posts/${created.id}`,
    await request(`/api/community/posts/${created.id}`, token, { method: 'DELETE' }),
  );

  console.log('\n— Profile —');
  const shell = assertOk(
    `GET /users/${user.id}/profile`,
    await request(`/api/community/users/${user.id}/profile`, token),
  );
  if (!shell?.user?.id) throw new Error('Profile shell: missing user');

  assertOk(
    `GET /users/${user.id}/profile/mentions`,
    await request(`/api/community/users/${user.id}/profile/mentions`, token),
  );
  assertOk(
    `GET /posts?authorId=${user.id}`,
    await request(`/api/community/posts?feed=for_you&authorId=${user.id}`, token),
  );
  assertOk(`GET /users/${user.id}/followers`, await request(`/api/community/users/${user.id}/followers`, token));
  assertOk(`GET /users/${user.id}/following`, await request(`/api/community/users/${user.id}/following`, token));

  console.log('\n— Profile bio (athlete) —');
  const bioRes = await request('/api/community/users/me/profile', token, {
    method: 'PATCH',
    body: { bio: `[verify-community] profile bio ${Date.now()}` },
  });
  assertOk('PATCH /users/me/profile (bio)', bioRes);
  assertOk(
    'PATCH /users/me/profile (bio restore)',
    await request('/api/community/users/me/profile', token, {
      method: 'PATCH',
      body: { bio: shell.user.profile?.bio ?? '' },
    }),
  );

  console.log('\n— Inbox —');
  const inboxPrimaryRes = await request('/api/community/inbox/conversations', token);
  const inboxPrimary = assertOk('GET /inbox/conversations', inboxPrimaryRes);
  if (!Array.isArray(inboxPrimary)) throw new Error('inbox primary: expected array');

  const inboxCachedRes = await request('/api/community/inbox/conversations', token);
  assertOk('GET /inbox/conversations (cached)', inboxCachedRes);
  console.log(`    inbox cold=${inboxPrimaryRes.ms}ms cached=${inboxCachedRes.ms}ms`);

  assertOk(
    'GET /inbox/conversations?refresh=1',
    await request('/api/community/inbox/conversations?refresh=1', token),
  );
  assertOk(
    'GET /inbox/conversations?folder=requests',
    await request('/api/community/inbox/conversations?folder=requests', token),
  );

  if (inboxPrimary.length > 0) {
    const convId = inboxPrimary[0].id;
    assertOk(
      `GET /inbox/conversations/${convId}/messages`,
      await request(`/api/community/inbox/conversations/${convId}/messages`, token),
    );
  }

  console.log('\n— Browse —');
  const discoverRes = await request('/api/community/users/browse/discover', token);
  const discover = assertOk('GET /users/browse/discover', discoverRes);
  if (!Array.isArray(discover)) throw new Error('discover: expected array');

  const discoverCachedRes = await request('/api/community/users/browse/discover', token);
  assertOk('GET /users/browse/discover (cached)', discoverCachedRes);
  console.log(`    discover cold=${discoverRes.ms}ms cached=${discoverCachedRes.ms}ms`);

  assertOk(
    'GET /users/browse/discover?refresh=1',
    await request('/api/community/users/browse/discover?refresh=1', token),
  );

  const searchQ = user.email.split('@')[0].slice(0, 3);
  if (searchQ.length >= 1) {
    const search = assertOk(
      `GET /users/search?q=${searchQ}`,
      await request(`/api/community/users/search?q=${encodeURIComponent(searchQ)}`, token),
    );
    if (!Array.isArray(search)) throw new Error('search: expected array');
    assertOk(
      `GET /users/search?q=${searchQ}&refresh=1`,
      await request(`/api/community/users/search?q=${encodeURIComponent(searchQ)}&refresh=1`, token),
    );
  }

  console.log('\n— Groups —');
  const groupsRes = await request('/api/community/groups', token);
  const groupsList = assertOk('GET /groups', groupsRes);
  if (!Array.isArray(groupsList)) throw new Error('groups: expected array');

  const groupsCachedRes = await request('/api/community/groups', token);
  assertOk('GET /groups (cached)', groupsCachedRes);
  console.log(`    groups cold=${groupsRes.ms}ms cached=${groupsCachedRes.ms}ms`);

  assertOk(
    'GET /groups?refresh=1',
    await request('/api/community/groups?refresh=1', token),
  );

  const createdGroup = assertOk(
    'POST /groups',
    await request('/api/community/groups', token, {
      method: 'POST',
      body: { name: `[verify-community] smoke ${Date.now()}`, description: 'auto test' },
    }),
    { minStatus: 201, maxStatus: 201 },
  );
  if (!createdGroup?.id) throw new Error('Create group: missing id');

  assertOk(
    `GET /groups/${createdGroup.id}`,
    await request(`/api/community/groups/${createdGroup.id}`, token),
  );

  assertOk(
    `DELETE /groups/${createdGroup.id}`,
    await request(`/api/community/groups/${createdGroup.id}`, token, { method: 'DELETE' }),
  );

  const groupSearchQ = (groupsList[0]?.name ?? 'gr').slice(0, 2);
  if (groupSearchQ.length >= 1) {
    assertOk(
      `GET /groups?q=${groupSearchQ}`,
      await request(`/api/community/groups?q=${encodeURIComponent(groupSearchQ)}`, token),
    );
  }

  console.log('\n— Cache repeat (should be faster) —');
  const t1 = Date.now();
  await request('/api/community/posts?feed=for_you', token);
  const t2 = Date.now();
  await request('/api/community/posts?feed=for_you', token);
  const t3 = Date.now();
  console.log(`  ✓ feed cold=${t2 - t1}ms cached=${t3 - t2}ms`);

  console.log('\n[verify-community] All checks passed.');
}

main()
  .catch((err) => {
    console.error('\n[verify-community] FAILED:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
