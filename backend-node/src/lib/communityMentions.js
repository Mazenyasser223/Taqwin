/**
 * Resolve @mentions in text to user IDs (display name, email local-part / handle).
 */
const { prisma } = require('../db');

function normalizeMentionToken(raw) {
  return String(raw || '')
    .replace(/^@+/, '')
    .trim()
    .toLowerCase();
}

function handleFromEmail(email) {
  const local = (email || 'user').split('@')[0];
  return local.replace(/[^a-zA-Z0-9_]/gi, '_').toLowerCase();
}

function displayNameKey(user) {
  const name = user.profile?.displayName?.trim();
  if (!name) return '';
  return name.replace(/\s+/g, '').toLowerCase();
}

function tokensFromText(text) {
  if (!text) return [];
  const found = new Set();
  for (const m of String(text).matchAll(/@([a-zA-Z0-9_\u00C0-\u024F\u0600-\u06FF]+)/gi)) {
    const t = normalizeMentionToken(m[1]);
    if (t.length >= 2) found.add(t);
  }
  return [...found];
}

async function findUserIdForToken(token, authorId, blockedIds) {
  const users = await prisma.user.findMany({
    where: {
      id: { not: authorId, notIn: blockedIds },
      OR: [
        { email: { contains: token, mode: 'insensitive' } },
        { profile: { displayName: { contains: token, mode: 'insensitive' } } },
      ],
    },
    select: {
      id: true,
      email: true,
      profile: { select: { displayName: true } },
    },
    take: 20,
  });

  for (const u of users) {
    if (handleFromEmail(u.email) === token) return u.id;
    if (displayNameKey(u) === token) return u.id;
    const dn = u.profile?.displayName?.trim().toLowerCase();
    if (dn === token) return u.id;
  }

  if (users.length === 1) return users[0].id;
  return null;
}

async function resolveUserIdsFromText(text, authorId, blockedIds = []) {
  const tokens = tokensFromText(text);
  const ids = [];
  for (const token of tokens) {
    const id = await findUserIdForToken(token, authorId, blockedIds);
    if (id) ids.push(id);
  }
  return [...new Set(ids)];
}

function mergeMentionIds(explicitIds = [], fromTextIds = []) {
  return [...new Set([...explicitIds.filter(Boolean), ...fromTextIds])];
}

module.exports = {
  normalizeMentionToken,
  tokensFromText,
  resolveUserIdsFromText,
  mergeMentionIds,
  findUserIdForToken,
};
