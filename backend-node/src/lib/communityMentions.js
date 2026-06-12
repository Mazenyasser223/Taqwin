/**
 * Resolve @mentions in text to user IDs (display name, email local-part / handle).
 */
const { prisma } = require('../db');
const { attachProfile, profileNameSearchFilter } = require('./profile');

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
  const normalized = attachProfile(user);
  const name = normalized?.profile?.displayName?.trim() || normalized?.profile?.businessName?.trim();
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
        ...profileNameSearchFilter(token).OR,
      ],
    },
    select: {
      id: true,
      email: true,
      role: true,
      athleteProfile: { select: { displayName: true } },
      gymProfile: { select: { displayName: true, businessName: true } },
    },
    take: 20,
  });

  for (const u of users) {
    const normalized = attachProfile(u);
    if (handleFromEmail(normalized.email) === token) return normalized.id;
    if (displayNameKey(normalized) === token) return normalized.id;
    const dn = normalized.profile?.displayName?.trim().toLowerCase()
      || normalized.profile?.businessName?.trim().toLowerCase();
    if (dn === token) return normalized.id;
  }

  if (users.length === 1) return users[0].id;
  return null;
}

async function resolveUserIdsFromText(text, authorId, blockedIds = []) {
  const tokens = tokensFromText(text);
  const ids = new Set();
  for (const token of tokens) {
    const id = await findUserIdForToken(token, authorId, blockedIds);
    if (id) ids.add(id);
  }
  return [...ids];
}

function mergeMentionIds(explicit = [], resolved = []) {
  return [...new Set([...explicit, ...resolved])];
}

module.exports = {
  normalizeMentionToken,
  resolveUserIdsFromText,
  mergeMentionIds,
  tokensFromText,
};
