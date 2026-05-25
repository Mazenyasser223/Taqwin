import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import communityService from '../../services/communityService';
import type { CommunityComment, CommunityPost } from '../../types';
import { PostComments } from './PostComments';
import { ReactionPicker } from './ReactionPicker';
import type { ReactionEmoji } from './reactions';
import { shareCommunityPost } from './communityShare';
import { EditPostModal } from './EditPostModal';
import { feedActionBar, feedActionBtn, feedCommentsPanel, feedIconBtn } from './communityFeedStyles';

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
  const [saved, setSaved] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [comments, setComments] = useState<CommunityComment[] | null>(null);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const commentCount = post.commentsCount ?? post._count?.comments ?? 0;

  useEffect(() => {
    communityService.isPostSaved(post.id).then((res) => setSaved(res.data?.saved ?? false));
    if (!isMine && post.authorId) {
      communityService.isRinging(post.authorId).then((res) => setRinging(res.data?.ringing ?? false));
    }
  }, [post.id, post.authorId, isMine]);

  useEffect(() => {
    if (!initialCommentsOpen) return;
    setCommentsOpen(true);
    if (comments === null) {
      communityService.getComments(post.id).then((res) => setComments(res.data ?? []));
    }
  }, [initialCommentsOpen, post.id, comments]);

  const reactToPost = async (emoji: ReactionEmoji) => {
    const snapshot = post;
    onPostChange(optimisticPostReaction(post, emoji));
    const res = await communityService.reactPost(post.id, emoji);
    if (res.data) onPostChange(res.data);
    else onPostChange(snapshot);
  };

  const toggleRepost = async () => {
    onPostChange({
      ...post,
      repostedByMe: !post.repostedByMe,
      repostsCount: post.repostsCount + (post.repostedByMe ? -1 : 1),
    });
    const res = await communityService.repostPost(post.id);
    if (res.data) onPostChange(res.data);
  };

  const toggleComments = async () => {
    if (commentsOpen) {
      setCommentsOpen(false);
      return;
    }
    setCommentsOpen(true);
    const cached = peekCommunityComments(post.id);
    if (cached) {
      setComments(cached);
      return;
    }
    if (comments === null) {
      const res = await communityService.getComments(post.id);
      setComments(res.data ?? []);
    }
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
      (msg) => setShareHint(msg)
    );
  };

  return (
    <>
      <motion.div className={feedActionBar}>
        <div className="flex items-center gap-1 sm:gap-2">
          <button type="button" onClick={toggleComments} className={feedActionBtn}>
            <span className="material-symbols-outlined text-xl">chat_bubble</span>
            <span className="font-semibold tabular-nums">{commentCount}</span>
          </button>
          <button
            type="button"
            onClick={toggleRepost}
            disabled={post.repostsLocked}
            className={`${feedActionBtn} ${post.repostedByMe ? '!text-primary bg-primary/10' : ''} disabled:opacity-40`}
          >
            <span className="material-symbols-outlined text-xl">repeat</span>
            <span className="font-semibold tabular-nums">{post.repostsCount}</span>
          </button>
          <ReactionPicker post={post} onReact={reactToPost} />
        </div>
        <div className="flex items-center gap-0.5">
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
            className={feedCommentsPanel}
          >
            <PostComments
              post={post}
              comments={comments ?? []}
              highlightCommentId={highlightCommentId}
              onCommentsChange={setComments}
              onCommentCountChange={(delta) =>
                onPostChange({
                  ...post,
                  commentsCount: Math.max(0, commentCount + delta),
                })
              }
            />
          </motion.div>
        )}
      </AnimatePresence>

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
