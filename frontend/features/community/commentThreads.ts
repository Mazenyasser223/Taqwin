import type { CommunityComment } from '../../types';

export const THREAD_PREVIEW_COUNT = 2;

export interface CommentThreadIndex {
  roots: CommunityComment[];
  repliesByParent: Map<string, CommunityComment[]>;
  byId: Map<string, CommunityComment>;
}

export function buildCommentThreadIndex(comments: CommunityComment[]): CommentThreadIndex {
  const roots: CommunityComment[] = [];
  const repliesByParent = new Map<string, CommunityComment[]>();
  const byId = new Map<string, CommunityComment>();

  for (const c of comments) {
    byId.set(c.id, c);
    if (!c.parentId) {
      roots.push(c);
      continue;
    }
    const list = repliesByParent.get(c.parentId) ?? [];
    list.push(c);
    repliesByParent.set(c.parentId, list);
  }

  for (const [, replies] of repliesByParent) {
    replies.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }
  roots.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return { roots, repliesByParent, byId };
}

export function ancestorIds(commentId: string, byId: Map<string, CommunityComment>): string[] {
  const chain: string[] = [];
  let current = byId.get(commentId);
  while (current?.parentId) {
    chain.push(current.parentId);
    current = byId.get(current.parentId);
  }
  return chain;
}

export function collectDescendantIds(
  commentId: string,
  repliesByParent: Map<string, CommunityComment[]>,
): Set<string> {
  const out = new Set<string>([commentId]);
  const queue = [commentId];
  while (queue.length) {
    const id = queue.pop();
    if (!id) continue;
    for (const child of repliesByParent.get(id) ?? []) {
      if (out.has(child.id)) continue;
      out.add(child.id);
      queue.push(child.id);
    }
  }
  return out;
}

export function rootsToExpandForHighlight(
  highlightCommentId: string,
  byId: Map<string, CommunityComment>,
  repliesByParent: Map<string, CommunityComment[]>,
): Set<string> {
  const toExpand = new Set<string>();
  const target = byId.get(highlightCommentId);
  if (!target) return toExpand;

  let current: CommunityComment | undefined = target;
  while (current?.parentId) {
    toExpand.add(current.parentId);
    current = byId.get(current.parentId);
  }

  for (const id of ancestorIds(highlightCommentId, byId)) {
    toExpand.add(id);
  }

  for (const [parentId, replies] of repliesByParent) {
    if (replies.some((r) => r.id === highlightCommentId)) {
      toExpand.add(parentId);
    }
  }

  return toExpand;
}
