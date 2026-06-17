const { prisma } = require('../../db');
const { redisGetJson, redisSetJson } = require('../../lib/redis');
const { mapAuthorIdentity } = require('../../lib/communityAuthors');
const { normalizeMediaUrl } = require('../../lib/normalizeMediaUrl');
const { AUTHOR_SELECT } = require('./constants');
const { getGroupsCacheGeneration } = require('./cacheGeneration');

const GROUPS_LIST_TTL_MS = 20_000;
const GROUP_DETAIL_TTL_MS = 15_000;
const GROUPS_MEM_TTL_MS = 90_000;
const memGroupsCache = new Map();

const GROUP_VIEWER_INCLUDE = (viewerId) => ({
  _count: { select: { members: true, posts: true } },
  members: {
    where: { userId: viewerId },
    select: { id: true, role: true, status: true, invitedBy: true },
  },
});

async function attachOwnersToGroups(groups) {
  const ownerIds = [...new Set(groups.map((g) => g.ownerId).filter(Boolean))];
  if (!ownerIds.length) return groups.map((g) => ({ ...g, owner: null }));
  const owners = await prisma.user.findMany({
    where: { id: { in: ownerIds } },
    select: AUTHOR_SELECT,
  });
  const ownerMap = new Map(owners.map((o) => [o.id, o]));
  return groups.map((g) => ({ ...g, owner: ownerMap.get(g.ownerId) ?? null }));
}

function isGroupOwner(group, userId) {
  return group.ownerId === userId;
}

function isGroupAdmin(group, membership) {
  if (!membership) return false;
  return isGroupOwner(group, membership.userId) || membership.role === 'admin';
}

function memberIsActive(membership) {
  return membership && (membership.status || 'accepted') === 'accepted';
}

function isInvitePending(membership) {
  return membership?.status === 'pending' && !!membership.invitedBy;
}

function isJoinRequestPending(membership) {
  return membership?.status === 'pending' && !membership.invitedBy;
}

function canPostToGroup(group, membership) {
  if (!memberIsActive(membership)) return false;
  if ((group.postPermission || 'all_members') === 'admins_only') {
    return isGroupAdmin(group, membership);
  }
  return true;
}

function canInviteToGroup(group, membership) {
  if (!memberIsActive(membership)) return false;
  if ((group.invitePermission || 'admins_only') === 'all_members') return true;
  return isGroupAdmin(group, membership);
}

function canViewGroupPosts(group, membership) {
  if ((group.postsVisibility || 'members_only') === 'public') return true;
  return memberIsActive(membership);
}

function canViewGroupMembersList(group, membership, viewerId) {
  if (isGroupOwner(group, viewerId)) return true;
  if (!memberIsActive(membership)) return false;
  if ((group.membersVisibility || 'all_members') === 'all_members') return true;
  return isGroupAdmin(group, membership);
}

function formatGroup(g, viewerId, membership, membersCount) {
  const active = memberIsActive(membership);
  const myRole = isGroupOwner(g, viewerId) ? 'owner' : membership?.role ?? null;
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    imageUrl: normalizeMediaUrl(g.imageUrl),
    ownerId: g.ownerId,
    owner: g.owner ? mapAuthorIdentity(g.owner) : undefined,
    membersCount: membersCount ?? 0,
    postsCount: g._count?.posts ?? 0,
    joined: active,
    invitePending: isInvitePending(membership),
    joinPending: isJoinRequestPending(membership),
    joinPolicy: g.joinPolicy || 'open',
    myRole,
    canManage: isGroupOwner(g, viewerId) || membership?.role === 'admin',
    canPost: canPostToGroup(g, membership),
    canInvite: canInviteToGroup(g, membership),
    canViewPosts: canViewGroupPosts(g, membership),
    canViewMembers: canViewGroupMembersList(g, membership, viewerId),
    postPermission: g.postPermission || 'all_members',
    invitePermission: g.invitePermission || 'admins_only',
    postsVisibility: g.postsVisibility || 'members_only',
    membersVisibility: g.membersVisibility || 'all_members',
    createdAt: g.createdAt,
  };
}

async function readGroupsCache(key) {
  const mem = memGroupsCache.get(key);
  if (mem && Date.now() - mem.at < GROUPS_MEM_TTL_MS) return mem.data;
  const hit = await redisGetJson(key);
  if (hit) memGroupsCache.set(key, { data: hit, at: Date.now() });
  return hit;
}

async function writeGroupsCache(key, data, ttlMs) {
  memGroupsCache.set(key, { data, at: Date.now() });
  await redisSetJson(key, data, ttlMs);
}

async function countAcceptedMembers(groupId) {
  return prisma.communityGroupMember.count({
    where: { groupId, status: 'accepted' },
  });
}

async function batchCountAcceptedMembers(groupIds) {
  const map = new Map();
  if (!groupIds.length) return map;
  const rows = await prisma.communityGroupMember.groupBy({
    by: ['groupId'],
    where: { groupId: { in: groupIds }, status: 'accepted' },
    _count: { id: true },
  });
  for (const row of rows) map.set(row.groupId, row._count.id);
  return map;
}

async function loadGroupRow(groupId, viewerId) {
  const group = await prisma.communityGroup.findUnique({
    where: { id: groupId },
    include: GROUP_VIEWER_INCLUDE(viewerId),
  });
  if (!group) return null;
  const [withOwner] = await attachOwnersToGroups([group]);
  return withOwner;
}

async function formatGroupRow(group, viewerId, membersCount) {
  if (!group) return null;
  const count = membersCount ?? (await countAcceptedMembers(group.id));
  const membership = group.members?.[0] ?? null;
  return formatGroup(group, viewerId, membership, count);
}

function rankGroupSearchResults(groups, q) {
  const needle = q.trim().toLowerCase();
  if (!needle) return groups;
  return [...groups].sort((a, b) => {
    const nameA = (a.name ?? '').toLowerCase();
    const nameB = (b.name ?? '').toLowerCase();
    const score = (name, desc) => {
      if (name.startsWith(needle)) return 0;
      if ((desc ?? '').toLowerCase().startsWith(needle)) return 1;
      return 2;
    };
    const diff = score(nameA, a.description) - score(nameB, b.description);
    if (diff !== 0) return diff;
    return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
  });
}

async function listGroups(viewerId, opts = {}) {
  const q = typeof opts.q === 'string' ? opts.q.trim() : '';
  if (q) return searchGroups(viewerId, q, opts);

  const skipCache = Boolean(opts.skipCache);
  const gen = await getGroupsCacheGeneration();
  const cacheKey = `community:groups:list:v3:${gen}:${viewerId}`;
  if (!skipCache) {
    const hit = await readGroupsCache(cacheKey);
    if (hit) return hit;
  }

  const groups = await prisma.communityGroup.findMany({
    include: GROUP_VIEWER_INCLUDE(viewerId),
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const withOwners = await attachOwnersToGroups(groups);
  const counts = await batchCountAcceptedMembers(withOwners.map((g) => g.id));
  const formatted = withOwners.map((g) =>
    formatGroup(g, viewerId, g.members?.[0] ?? null, counts.get(g.id) ?? 0),
  );
  await writeGroupsCache(cacheKey, formatted, GROUPS_LIST_TTL_MS);
  return formatted;
}

async function searchGroups(viewerId, q, opts = {}) {
  const skipCache = Boolean(opts.skipCache);
  const gen = await getGroupsCacheGeneration();
  const cacheKey = `community:groups:search:v2:${gen}:${viewerId}:${q.toLowerCase()}`;
  if (!skipCache) {
    const hit = await readGroupsCache(cacheKey);
    if (hit) return hit;
  }

  const take = q.length <= 2 ? 50 : 30;
  const groups = await prisma.communityGroup.findMany({
    where: {
      OR: [
        { name: { startsWith: q, mode: 'insensitive' } },
        { description: { startsWith: q, mode: 'insensitive' } },
        ...(q.length <= 2
          ? [
              { name: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ]
          : []),
      ],
    },
    include: GROUP_VIEWER_INCLUDE(viewerId),
    orderBy: { createdAt: 'desc' },
    take,
  });
  const withOwners = await attachOwnersToGroups(groups);
  const counts = await batchCountAcceptedMembers(withOwners.map((g) => g.id));
  const formatted = rankGroupSearchResults(
    withOwners.map((g) =>
      formatGroup(g, viewerId, g.members?.[0] ?? null, counts.get(g.id) ?? 0),
    ),
    q,
  );
  await writeGroupsCache(cacheKey, formatted, GROUPS_LIST_TTL_MS);
  return formatted;
}

async function getGroup(viewerId, groupId, opts = {}) {
  const skipCache = Boolean(opts.skipCache);
  const gen = await getGroupsCacheGeneration();
  const cacheKey = `community:groups:detail:v3:${gen}:${viewerId}:${groupId}`;
  if (!skipCache) {
    const hit = await readGroupsCache(cacheKey);
    if (hit) return hit;
  }

  const group = await loadGroupRow(groupId, viewerId);
  if (!group) return null;
  const counts = await batchCountAcceptedMembers([groupId]);
  const formatted = formatGroup(
    group,
    viewerId,
    group.members?.[0] ?? null,
    counts.get(groupId) ?? 0,
  );
  await writeGroupsCache(cacheKey, formatted, GROUP_DETAIL_TTL_MS);
  return formatted;
}

module.exports = {
  formatGroup,
  formatGroupRow,
  countAcceptedMembers,
  batchCountAcceptedMembers,
  loadGroupRow,
  listGroups,
  searchGroups,
  getGroup,
  memberIsActive,
  isGroupAdmin,
  isGroupOwner,
  canViewGroupMembersList,
};
