import type { CommunityConversation } from '../../types';

/** Starred chats float above the rest; within each tier sort by recency. */
export function sortInboxConversations(list: CommunityConversation[]): CommunityConversation[] {
  return [...list].sort((a, b) => {
    if (a.isStarred && !b.isStarred) return -1;
    if (!a.isStarred && b.isStarred) return 1;
    if (a.isStarred && b.isStarred) {
      const starDiff =
        new Date(b.starredAt || b.updatedAt).getTime() - new Date(a.starredAt || a.updatedAt).getTime();
      if (starDiff !== 0) return starDiff;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function bumpConversationInList(
  list: CommunityConversation[],
  conversationId: string,
  lastMessage: NonNullable<CommunityConversation['lastMessage']>,
): CommunityConversation[] {
  const idx = list.findIndex((c) => c.id === conversationId);
  if (idx < 0) return list;
  const updated = {
    ...list[idx],
    lastMessage,
    unreadCount: 0,
    updatedAt: lastMessage.createdAt,
  };
  return sortInboxConversations(list.filter((c) => c.id !== conversationId).concat(updated));
}

export function patchConversationInLists(
  list: CommunityConversation[],
  conversationId: string,
  patch: Partial<CommunityConversation>,
): CommunityConversation[] {
  return sortInboxConversations(
    list.map((c) => (c.id === conversationId ? { ...c, ...patch } : c)),
  );
}
