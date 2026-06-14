import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useI18n } from '../../lib/i18n/useI18n';
import communityService from '../../services/communityService';
import type { CommunityComment, CommunityPost } from '../../types';
import { displayName, timeAgo, communityProfilePath } from './communityUtils';
import { CommunityAuthorAvatar } from './CommunityAuthorAvatar';
import { EmojiComposer } from './EmojiComposer';
import { CommentReactionPicker } from './CommentReactionPicker';
import { buildOptimisticComment } from './communityOptimistic';
import type { ReactionEmoji } from './reactions';
import {
  THREAD_PREVIEW_COUNT,
  ancestorIds,
  buildCommentThreadIndex,
  collectDescendantIds,
  rootsToExpandForHighlight,
} from './commentThreads';

interface PostCommentsProps {
  post: CommunityPost;
  comments: CommunityComment[];
  highlightCommentId?: string | null;
  onCommentsChange: (comments: CommunityComment[]) => void;
  onCommentCountChange: (delta: number) => void;
}

export const PostComments: React.FC<PostCommentsProps> = ({
  post,
  comments,
  highlightCommentId = null,
  onCommentsChange,
  onCommentCountChange,
}) => {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const isPostOwner = user?.id === post.authorId;

  const [commentDraft, setCommentDraft] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(() => new Set());
  const highlightedRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const threadIndex = useMemo(() => buildCommentThreadIndex(comments), [comments]);
  const { roots, repliesByParent, byId } = threadIndex;

  const replyTarget = replyToId ? byId.get(replyToId) : null;

  useEffect(() => {
    if (!highlightCommentId) return;
    const toExpand = rootsToExpandForHighlight(highlightCommentId, byId, repliesByParent);
    if (toExpand.size) {
      setExpandedThreads((prev) => new Set([...prev, ...toExpand]));
    }
    const timer = window.setTimeout(() => {
      highlightedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [highlightCommentId, comments.length, byId, repliesByParent]);

  const updateCommentInList = (updated: CommunityComment) => {
    onCommentsChange(
      comments.map((c) =>
        c.id === updated.id
          ? {
              ...c,
              ...updated,
              replyTo: updated.replyTo ?? c.replyTo,
              repliesCount: updated.repliesCount ?? c.repliesCount,
            }
          : c,
      ),
    );
  };

  const removeCommentFromList = (commentId: string) => {
    const toRemove = collectDescendantIds(commentId, repliesByParent);
    const removed = comments.filter((c) => toRemove.has(c.id));
    onCommentsChange(comments.filter((c) => !toRemove.has(c.id)));
    onCommentCountChange(-removed.length);
    if (replyToId && toRemove.has(replyToId)) {
      setReplyToId(null);
      setCommentDraft('');
    }
  };

  const startReply = (comment: CommunityComment) => {
    setReplyToId(comment.id);
    const handle = displayName(comment.author);
    setCommentDraft((prev) => (prev.startsWith(`@${handle} `) ? prev : `@${handle} `));
    window.setTimeout(() => composerRef.current?.focus(), 0);
  };

  const cancelReply = () => {
    setReplyToId(null);
    setCommentDraft('');
  };

  const submitComment = async () => {
    const draft = commentDraft.trim();
    if (!draft || submitting || !user) return;
    setSubmitting(true);
    const parent = replyToId;
    const optimistic = buildOptimisticComment(post.id, draft, user, parent);
    if (parent) {
      const parentComment = byId.get(parent);
      optimistic.replyTo = parentComment
        ? { id: parentComment.id, author: parentComment.author }
        : null;
    }
    let nextComments = [...comments, optimistic];
    onCommentsChange(nextComments);
    onCommentCountChange(1);
    if (parent) {
      const chain = ancestorIds(parent, byId);
      const rootId = chain[chain.length - 1];
      setExpandedThreads((prev) => new Set([...prev, parent, rootId].filter(Boolean)));
    }
    setCommentDraft('');
    setReplyToId(null);
    const res = await communityService.addComment(post.id, {
      content: draft,
      parentId: parent ?? undefined,
    });
    setSubmitting(false);
    if (res.data) {
      nextComments = nextComments.map((c) => (c.id === optimistic.id ? res.data! : c));
      onCommentsChange(nextComments);
    } else {
      onCommentsChange(comments);
      onCommentCountChange(-1);
    }
  };

  const saveEdit = async (commentId: string) => {
    const draft = editDraft.trim();
    if (!draft) return;
    const res = await communityService.updateComment(commentId, draft);
    if (res.data) {
      updateCommentInList(res.data);
      setEditingId(null);
      setEditDraft('');
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!window.confirm(t('community.deleteCommentConfirm'))) return;
    const res = await communityService.deleteComment(commentId);
    if (res.data?.ok) removeCommentFromList(commentId);
  };

  const reactToComment = async (commentId: string, emoji: ReactionEmoji) => {
    const res = await communityService.reactComment(commentId, emoji);
    if (res.data) updateCommentInList(res.data);
  };

  const toggleThreadExpanded = (commentId: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const renderCommentBody = (c: CommunityComment) => {
    const isMine = user?.id === c.authorId;
    const canDelete = isMine || isPostOwner;
    const isEditing = editingId === c.id;
    const highlighted = highlightCommentId === c.id;

    if (isEditing) {
      return (
        <div className="space-y-2">
          <EmojiComposer
            value={editDraft}
            onChange={setEditDraft}
            multiline
            placeholder={t('community.editComment')}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => saveEdit(c.id)}
              className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-lg"
            >
              {t('common.save')}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setEditDraft('');
              }}
              className="px-3 py-1 text-xs text-muted"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      );
    }

    return (
      <>
        {c.replyTo?.author && (
          <p className="text-[11px] text-muted mb-0.5">
            {t('community.replyingToUser')}{' '}
            <Link
              to={communityProfilePath(c.replyTo.author.id ?? c.replyTo.id)}
              className="text-primary font-bold hover:underline"
            >
              @{displayName(c.replyTo.author)}
            </Link>
          </p>
        )}
        <p className="text-sm text-foreground/85 leading-relaxed break-words">
          <Link
            to={communityProfilePath(c.authorId)}
            className="font-bold text-foreground mr-1 hover:text-primary"
          >
            {displayName(c.author)}
          </Link>
          {c.content}
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <p className="text-[10px] text-faint">{timeAgo(c.updatedAt || c.createdAt)}</p>
          {c.pending && (
            <span className="text-[10px] text-primary font-bold">{t('community.posting')}</span>
          )}
          <CommentReactionPicker comment={c} onReact={(emoji) => reactToComment(c.id, emoji)} />
          {!post.commentsLocked && (
            <button
              type="button"
              onClick={() => startReply(c)}
              className="text-[10px] font-bold text-muted hover:text-primary"
            >
              {t('community.reply')}
            </button>
          )}
          {(c.repliesCount ?? 0) > 0 && (
            <span className="text-[10px] text-faint">
              {t('community.replyCount', { count: String(c.repliesCount ?? 0) })}
            </span>
          )}
          {isMine && (
            <button
              type="button"
              onClick={() => {
                setEditingId(c.id);
                setEditDraft(c.content);
              }}
              className="text-[10px] font-bold text-muted hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {t('community.editComment')}
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => deleteComment(c.id)}
              className="text-[10px] font-bold text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {t('community.deleteComment')}
            </button>
          )}
        </div>
      </>
    );
  };

  const renderComment = (c: CommunityComment, depth = 0) => {
    const childReplies = repliesByParent.get(c.id) ?? [];
    const isExpanded = expandedThreads.has(c.id) || childReplies.length <= THREAD_PREVIEW_COUNT;
    const hiddenCount = isExpanded ? 0 : Math.max(0, childReplies.length - THREAD_PREVIEW_COUNT);
    const visibleReplies = isExpanded ? childReplies : childReplies.slice(0, THREAD_PREVIEW_COUNT);
    const highlighted = highlightCommentId === c.id;

    return (
      <div
        key={c.id}
        ref={highlighted ? highlightedRef : undefined}
        className={highlighted ? 'rounded-xl ring-2 ring-primary/50 bg-primary/5 p-1 -m-1' : ''}
      >
        <div className={`flex gap-2 group ${depth > 0 ? 'pt-3' : ''}`}>
          <div className="flex flex-col items-center shrink-0">
            <CommunityAuthorAvatar
              userId={c.authorId}
              avatarUrl={c.author?.profile?.communityAvatarUrl}
              displayName={displayName(c.author)}
              imageClassName="size-8 rounded-full object-cover"
            />
            {childReplies.length > 0 && (
              <div className="w-0.5 flex-1 min-h-[12px] mt-1 bg-subtle/80 rounded-full" aria-hidden />
            )}
          </div>
          <div className="flex-1 min-w-0 pb-1">{renderCommentBody(c)}</div>
        </div>

        {visibleReplies.length > 0 && (
          <div className="ml-4 pl-4 border-l border-subtle/80">
            {visibleReplies.map((r) => renderComment(r, depth + 1))}
          </div>
        )}

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => toggleThreadExpanded(c.id)}
            className="ml-10 mt-1 text-xs font-bold text-primary hover:underline"
          >
            {t('community.showMoreReplies', { count: String(hiddenCount) })}
          </button>
        )}
        {isExpanded && childReplies.length > THREAD_PREVIEW_COUNT && (
          <button
            type="button"
            onClick={() => toggleThreadExpanded(c.id)}
            className="ml-10 mt-1 text-xs font-bold text-muted hover:text-primary"
          >
            {t('community.hideReplies')}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-5 space-y-4">
      {roots.length === 0 && <p className="text-faint text-xs">{t('community.noComments')}</p>}
      <div className="space-y-4">{roots.map((c) => renderComment(c))}</div>

      {!post.commentsLocked ? (
        <div className="pt-2 space-y-2 border-t border-subtle/60">
          {replyTarget && (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-elevated/60 border border-subtle px-3 py-2">
              <div className="flex items-center gap-2 min-w-0 text-xs text-muted">
                <CommunityAuthorAvatar
                  userId={replyTarget.authorId}
                  avatarUrl={replyTarget.author?.profile?.communityAvatarUrl}
                  displayName={displayName(replyTarget.author)}
                  imageClassName="size-6 rounded-full object-cover shrink-0"
                />
                <span className="truncate">
                  {t('community.replyingToUser')}{' '}
                  <span className="font-bold text-foreground">@{displayName(replyTarget.author)}</span>
                </span>
              </div>
              <button type="button" onClick={cancelReply} className="text-primary font-bold text-xs shrink-0">
                {t('common.cancel')}
              </button>
            </div>
          )}
          <div className="flex gap-2 items-end">
            <EmojiComposer
              value={commentDraft}
              onChange={setCommentDraft}
              onSubmit={submitComment}
              placeholder={
                replyTarget ? t('community.replyPlaceholder') : t('community.commentPlaceholder')
              }
              className="flex-1"
              multiline
              rows={2}
              inputRef={composerRef}
            />
            <button
              type="button"
              onClick={submitComment}
              disabled={submitting || !commentDraft.trim()}
              className="px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-xl shrink-0 shadow-sm shadow-primary/20 hover:brightness-110 transition-all disabled:opacity-50"
            >
              {submitting ? t('community.posting') : replyTarget ? t('community.reply') : t('community.post')}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted pt-2">{t('community.commentsLocked')}</p>
      )}
    </div>
  );
};
