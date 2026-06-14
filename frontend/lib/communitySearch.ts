import type { CommunityAuthor, CommunityConversation, CommunityGroup } from '../types';
import { displayName } from '../features/community/communityUtils';

export function normalizeSearchQuery(q: string): string {
  return q.trim().toLowerCase();
}

export function matchesPrefix(text: string | null | undefined, needle: string): boolean {
  if (!needle) return true;
  const hay = (text ?? '').trim().toLowerCase();
  if (!hay) return false;
  return hay.startsWith(needle);
}

/** Match display name, @handle, or email local part — prefix only. */
export function userMatchesPrefix(user: CommunityAuthor | null | undefined, rawNeedle: string): boolean {
  const needle = normalizeSearchQuery(rawNeedle);
  if (!needle || !user) return !needle;

  const name = displayName(user).toLowerCase();
  const handle = (user.handle ?? '').replace(/^@/, '').toLowerCase();
  const emailLocal = (user.email ?? '').split('@')[0]?.toLowerCase() ?? '';

  return (
    matchesPrefix(name, needle) ||
    matchesPrefix(handle, needle) ||
    matchesPrefix(emailLocal, needle) ||
    matchesPrefix(user.email, needle)
  );
}

export function filterUsersByPrefix(users: CommunityAuthor[], rawNeedle: string): CommunityAuthor[] {
  const needle = normalizeSearchQuery(rawNeedle);
  if (!needle) return users;
  return users.filter((u) => userMatchesPrefix(u, needle));
}

export function filterGroupsByPrefix(groups: CommunityGroup[], rawNeedle: string): CommunityGroup[] {
  const needle = normalizeSearchQuery(rawNeedle);
  if (!needle) return groups;
  return groups.filter((g) => {
    const name = (g.name ?? '').toLowerCase();
    const desc = (g.description ?? '').toLowerCase();
    return name.startsWith(needle) || desc.startsWith(needle);
  });
}

export function filterConversationsByPrefix(
  conversations: CommunityConversation[],
  rawNeedle: string,
): CommunityConversation[] {
  const needle = normalizeSearchQuery(rawNeedle);
  if (!needle) return conversations;
  return conversations.filter((c) => {
    const title = c.isGroup
      ? (c.name ?? '').toLowerCase()
      : displayName(c.otherUser).toLowerCase();
    return title.startsWith(needle);
  });
}
