import React, { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import communityService from '../../services/communityService';
import type { CommunityComment, CommunityPost } from '../../types';
import { PostComments } from './PostComments';
import { PostReactionsSummary } from './PostReactionsSummary';
import { PostRepostersModal } from './PostRepostersModal';
import { ReactionPicker } from './ReactionPicker';
import { CommentsSkeleton } from './CommentsSkeleton';
import type { ReactionEmoji } from './reactions';
import { shareCommunityPost } from './communityShare';
import { EditPostModal } from './EditPostModal';
import { feedActionBar, feedCommentsPanel, feedIconBtn } from './communityFeedStyles';
import { optimisticPostReaction, mergePostInteraction } from './communityOptimistic';
import {
  peekCommunityComments,
  patchPostInAllFeedCaches,
  prefetchCommunityComments,
} from '../../lib/communityCache';
import { useCommunityLivePoll, COMMUNITY_COMMENTS_POLL_MS } from './useCommunityLivePoll';

interface CommunityPostInteractionsProps {
  post: CommunityPost;
  onPostChange: (post: CommunityPost) => void;
  initialCommentsOpen?: boolean;
  highlightCommentId?: string | null;
}

export const CommunityPostInteractions: React.FC<CommunityPostInteractionsProps> = ({
  post,
  onPostChange,
  initialCommentsOpen = false,
  highlightCommentId = null,
}) => {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const isMine = user?.id === post.authorId;
  const [commentsOpen, setCommentsOpen] = useState(initialCommentsOpen);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [comments, setComments] = useState<CommunityComment[] | null>(() =>
    initialCommentsOpen ? peekCommunityComments(post.id) : null,
  );
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [repostersOpen, setRepostersOpen] = useState(false);

  const commentCount = post.commentsCount ?? post._count?.comments ?? 0;
  const repostsCount = post.repostsCount ?? 0;

  const loadComments = useCallback(
    (opts?: { silent?: boolean }) => {
      const cached = peekCommunityComments(post.id);
      if (cached) {
        setComments(cached);
        if (!opts?.silent) setCommentsLoading(false);
        communityService.revalidateComments(post.id, (data) => setComments(data));
        return;
      }
      if (!opts?.silent) setCommentsLoading(true);
      void communityService.getComments(post.id).then((res) => {
        setComments(res.data ?? []);
        setCommentsLoading(false);
      });
    },
    [post.id],
  );

  useEffect(() => {
    if (commentCount > 0) prefetchCommunityComments(post.id);
  }, [post.id, commentCount]);

  useEffect(() => {
    if (!initialCommentsOpen) return;
    setCommentsOpen(true);
    loadComments();
  }, [initialCommentsOpen, loadComments]);

  useCommunityLivePoll(
    () => {
      if (!commentsOpen) return;
      void communityService.revalidateComments(post.id, (data) => setComments(data));
    },
    COMMUNITY_COMMENTS_POLL_MS,
    commentsOpen,
    false,
  );

  const applyPostUpdate = (updated: CommunityPost) => {
    onPostChange(updated);
    patchPostInAllFeedCaches(post.id, updated);
  };

  const reactToPost = async (emoji: ReactionEmoji) => {
    const snapshot = post;
    applyPostUpdate(optimisticPostReaction(post, emoji));
    const res = await communityService.reactPost(post.id, emoji);
    if (res.data) applyPostUpdate(mergePostInteraction(snapshot, res.data));
    else applyPostUpdate(snapshot);
  };

  const toggleRepost = async () => {
    if (isMine) {
      if (repostsCount > 0) setRepostersOpen(true);
      return;
    }
    const snapshot = post;
    applyPostUpdate({
      ...post,
      repostedByMe: !post.repostedByMe,
      repostsCount: post.repostsCount + (post.repostedByMe ? -1 : 1),
    });
    const res = await communityService.repostPost(post.id);
    if (res.data) applyPostUpdate(mergePostInteraction(snapshot, res.data));
    else applyPostUpdate(snapshot);
  };

  const openComments = () => {
    setCommentsOpen(true);
    if (comments === null) loadComments();
    else loadComments({ silent: true });
  };

  const toggleComments = () => {
    if (commentsOpen) {
      setCommentsOpen(false);
      return;
    }
    openComments();
  };

  const toggleSave = async () => {
    const next = !saved;
    setSaved(next);
    const res = await communityService.toggleSavePost(post.id);
    if (res.data) setSaved(res.data.saved);
    else setSaved(!next);
  };

  const toggleRing = async () => {
    if (!post.authorId) return;
    const res = await communityService.toggleRing(post.authorId);
    if (res.data) setRinging(res.data.ringing);
  };

  const sharePost = async () => {
    if (post.canShare === false) {
      setShareHint(t('community.shareNotAllowed'));
      window.setTimeout(() => setShareHint(null), 2500);
      return;
    }
    setShareHint(null);
    await shareCommunityPost(
      post,
      () => {
        setShareHint(t('community.linkCopied'));
        window.setTimeout(() => setShareHint(null), 2500);
      },
      (msg) => setShareHint(msg),
    );
  };

  return (
    <>
      <PostReactionsSummary
        post={post}
        commentCount={commentCount}
        repostsCount={repostsCount}
        isPostOwner={isMine}
        onCommentsClick={openComments}
        onRepostsClick={isMine && repostsCount > 0 ? () => setRepostersOpen(true) : undefined}
      />

      <motion.div className={`${feedActionBar} !py-0 flex-col gap-0`}>
        <div className="w-full flex items-stretch border-b border-white/[0.06] divide-x divide-white/[0.06]">
          <ReactionPicker post={post} onReact={reactToPost} />
          <button
            type="button"
            onClick={openComments}
            onMouseEnter={() => prefetchCommunityComments(post.id)}
            onFocus={() => prefetchCommunityComments(post.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors hover:bg-white/[0.06] ${
              commentsOpen ? 'text-primary' : 'text-muted'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">chat_bubble</span>
            <span>{t('community.comment')}</span>
          </button>
          <button
            type="button"
            onClick={toggleRepost}
            disabled={post.repostsLocked || (isMine && repostsCount === 0)}
            title={isMine ? t('community.viewReposters') : undefined}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors hover:bg-white/[0.06] disabled:opacity-40 ${
              post.repostedByMe || (isMine && repostsCount > 0) ? 'text-primary' : 'text-muted'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">
              {isMine && repostsCount > 0 ? 'group' : 'repeat'}
            </span>
            <span>{isMine && repostsCount > 0 ? t('community.reposters') : t('community.repost')}</span>
          </button>
        </div>

        <div className="w-full flex items-center justify-end gap-0.5 px-1 py-1">
          <button
            type="button"
            onClick={toggleSave}
            className={`${feedIconBtn} ${saved ? '!text-primary bg-primary/10' : ''}`}
            title={t('community.savePost')}
          >
            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: saved ? "'FILL' 1" : '' }}>
              bookmark
            </span>
          </button>
          {!isMine && (
            <button
              type="button"
              onClick={toggleRing}
              className={`${feedIconBtn} ${ringing ? '!text-amber-400 bg-amber-400/10' : ''}`}
              title={t('community.ringNotify')}
            >
              <span className="material-symbols-outlined text-xl">notifications_active</span>
            </button>
          )}
          {isMine && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className={feedIconBtn}
              title={t('community.editPost')}
            >
              <span className="material-symbols-outlined text-xl">edit</span>
            </button>
          )}
          <button
            type="button"
            onClick={sharePost}
            disabled={post.canShare === false}
            className={`${feedIconBtn} disabled:opacity-40`}
            title={t('community.share')}
          >
            <span className="material-symbols-outlined text-xl">share</span>
          </button>
        </div>
        {shareHint && <span className="text-[10px] text-primary w-full text-right">{shareHint}</span>}
      </motion.div>

      <AnimatePresence>
        {commentsOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={feedCommentsPanel}
          >
            {commentsLoading && !comments?.length ? (
              <CommentsSkeleton />
            ) : (
              <PostComments
                post={post}
                comments={comments ?? []}
                highlightCommentId={highlightCommentId}
                onCommentsChange={setComments}
                onCommentCountChange={(delta) => {
                  const nextCount = Math.max(0, commentCount + delta);
                  applyPostUpdate({
                    ...post,
                    commentsCount: nextCount,
                    _count: post._count ? { ...post._count, comments: nextCount } : post._count,
                  });
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {repostersOpen && (
        <PostRepostersModal
          postId={post.id}
          repostsCount={repostsCount}
          onClose={() => setRepostersOpen(false)}
        />
      )}

      {isMine && (
        <EditPostModal
          post={post}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={onPostChange}
        />
      )}
    </>
  );
};
