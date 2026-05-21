import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import communityService from '../../services/communityService';
import type { CommunityComment, CommunityPost } from '../../types';
import { displayName, fallbackAvatar, timeAgo } from './communityUtils';
import { ReactionPicker } from './ReactionPicker';
import type { ReactionEmoji } from './reactions';
import { shareCommunityPost } from './communityShare';
import { EditPostModal } from './EditPostModal';

interface CommunityPostInteractionsProps {
  post: CommunityPost;
  onPostChange: (post: CommunityPost) => void;
}

export const CommunityPostInteractions: React.FC<CommunityPostInteractionsProps> = ({ post, onPostChange }) => {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const isMine = user?.id === post.authorId;
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [comments, setComments] = useState<CommunityComment[] | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const commentCount = post.commentsCount ?? post._count?.comments ?? 0;

  useEffect(() => {
    communityService.isPostSaved(post.id).then((res) => setSaved(res.data?.saved ?? false));
    if (!isMine && post.authorId) {
      communityService.isRinging(post.authorId).then((res) => setRinging(res.data?.ringing ?? false));
    }
  }, [post.id, post.authorId, isMine]);

  const reactToPost = async (emoji: ReactionEmoji) => {
    const res = await communityService.reactPost(post.id, emoji);
    if (res.data) onPostChange(res.data);
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
    if (comments === null) {
      const res = await communityService.getComments(post.id);
      setComments(res.data ?? []);
    }
  };

  const submitComment = async () => {
    const draft = commentDraft.trim();
    if (!draft) return;
    const res = await communityService.addComment(post.id, { content: draft });
    if (res.data) {
      setComments((c) => [...(c ?? []), res.data!]);
      setCommentDraft('');
      onPostChange({
        ...post,
        commentsCount: commentCount + 1,
      });
    }
  };

  const toggleSave = async () => {
    const res = await communityService.toggleSavePost(post.id);
    if (res.data) setSaved(res.data.saved);
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
      <motion.div className="px-4 py-3 border-t border-subtle flex items-center justify-between text-muted">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={toggleComments}
            className="flex items-center gap-1.5 hover:text-primary transition-colors text-sm"
          >
            <span className="material-symbols-outlined text-xl">chat_bubble</span>
            <span className="font-semibold tabular-nums">{commentCount}</span>
          </button>
          <button
            type="button"
            onClick={toggleRepost}
            disabled={post.repostsLocked}
            className={`flex items-center gap-1.5 transition-colors text-sm ${post.repostedByMe ? 'text-primary' : 'hover:text-primary'} disabled:opacity-40`}
          >
            <span className="material-symbols-outlined text-xl">repeat</span>
            <span className="font-semibold tabular-nums">{post.repostsCount}</span>
          </button>
          <ReactionPicker post={post} onReact={reactToPost} />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleSave}
            className={`p-1 transition-colors ${saved ? 'text-primary' : 'hover:text-primary text-muted'}`}
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
              className={`p-1 transition-colors ${ringing ? 'text-amber-400' : 'hover:text-amber-400 text-muted'}`}
              title={t('community.ringNotify')}
            >
              <span className="material-symbols-outlined text-xl">notifications_active</span>
            </button>
          )}
          {isMine && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="hover:text-primary text-muted p-1"
              title={t('community.editPost')}
            >
              <span className="material-symbols-outlined text-xl">edit</span>
            </button>
          )}
          <button
            type="button"
            onClick={sharePost}
            disabled={post.canShare === false}
            className="hover:text-primary transition-colors p-1 disabled:opacity-40"
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
            className="border-t border-subtle bg-black/20 overflow-hidden"
          >
            <div className="p-4 space-y-3">
              {(comments ?? []).length === 0 && <p className="text-faint text-xs">{t('community.noComments')}</p>}
              {(comments ?? []).map((c) => (
                <div key={c.id} className="flex gap-2">
                  <img
                    src={c.author?.profile?.avatarUrl || fallbackAvatar(c.authorId)}
                    alt=""
                    className="size-8 rounded-full shrink-0"
                  />
                  <div>
                    <p className="text-sm">
                      <span className="font-bold mr-1">{displayName(c.author)}</span>
                      {c.content}
                    </p>
                    <p className="text-[10px] text-faint mt-0.5">{timeAgo(c.createdAt)}</p>
                  </div>
                </div>
              ))}
              {!post.commentsLocked ? (
                <div className="flex gap-2 pt-2">
                  <input
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                    placeholder={t('community.commentPlaceholder')}
                    className="flex-1 bg-elevated border border-subtle rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="button"
                    onClick={submitComment}
                    className="px-4 bg-primary text-white text-sm font-bold rounded-xl"
                  >
                    {t('community.post')}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted pt-2">{t('community.commentsLocked')}</p>
              )}
            </div>
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
