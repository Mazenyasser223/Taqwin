import type { CommunityComment, CommunityPost, User } from '../../types';
import type { ReactionEmoji } from './reactions';

/** Instant UI update before react API returns. */
export function optimisticPostReaction(post: CommunityPost, emoji: ReactionEmoji): CommunityPost {
  const prev = post.myReaction;
  const reactions = { ...(post.reactions ?? {}) };
  let likesCount = post.likesCount ?? 0;

  const dec = (e: ReactionEmoji) => {
    const n = Math.max(0, (reactions[e] ?? 0) - 1);
    if (n === 0) delete reactions[e];
    else reactions[e] = n;
  };

  if (prev === emoji) {
    if (prev) dec(prev);
    return { ...post, myReaction: null, reactions, likesCount: Math.max(0, likesCount - 1) };
  }

  if (prev) {
    dec(prev);
  } else {
    likesCount += 1;
  }
  reactions[emoji] = (reactions[emoji] ?? 0) + 1;

  return { ...post, myReaction: emoji, reactions, likesCount };
}

/** Merge lightweight interaction patch from API into full post. */
export function mergePostInteraction(
  post: CommunityPost,
  patch: Partial<CommunityPost> | null | undefined,
): CommunityPost {
  if (!patch) return post;
  return {
    ...post,
    ...patch,
    _count: post._count
      ? {
          ...post._count,
          comments: patch.commentsCount ?? post._count.comments,
          likes: patch.likesCount ?? post._count.likes,
          reposts: patch.repostsCount ?? post._count.reposts,
        }
      : post._count,
  };
}

export function buildOptimisticComment(
  postId: string,
  content: string,
  user: User,
  parentId?: string | null,
): CommunityComment {
  const now = new Date().toISOString();
  return {
    id: `pending-${Date.now()}`,
    postId,
    authorId: user.id,
    parentId: parentId ?? null,
    content,
    createdAt: now,
    updatedAt: now,
    author: {
      id: user.id,
      email: user.email,
      role: user.role,
      profile: user.profile
        ? {
            displayName: user.profile.displayName,
            communityAvatarUrl: user.profile.communityAvatarUrl ?? null,
          }
        : undefined,
    },
    likesCount: 0,
    reactions: {},
    myReaction: null,
    pending: true,
  };
}
