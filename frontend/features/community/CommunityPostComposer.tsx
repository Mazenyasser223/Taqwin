import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import type { CommunityPost } from '../../types';
import type { CreatePostData } from '../../services/communityService';
import { useAuthStore } from '../../store/useAuthStore';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { MentionPicker, finalizeMentions, type MentionSelection } from './MentionPicker';
import { PostMediaEditor, toMediaPayload, type DraftMediaItem } from './PostMediaEditor';

interface CommunityPostComposerProps {
  placeholder: string;
  canPost?: boolean;
  disabledReason?: string;
  onPost: (payload: CreatePostData) => Promise<CommunityPost | null>;
  onError?: (message: string) => void;
}

export const CommunityPostComposer: React.FC<CommunityPostComposerProps> = ({
  placeholder,
  canPost = true,
  disabledReason,
  onPost,
  onError,
}) => {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [mediaItems, setMediaItems] = useState<DraftMediaItem[]>([]);
  const [posting, setPosting] = useState(false);
  const [mentions, setMentions] = useState<MentionSelection>({ userIds: [], gymIds: [], labels: [] });
  const [commentsLocked, setCommentsLocked] = useState(false);
  const [repostsLocked, setRepostsLocked] = useState(false);
  const mentionQueryRef = useRef('');
  const canSubmit = content.trim().length > 0 || mediaItems.length > 0;

  const submitPost = async () => {
    if (!canPost || !canSubmit) return;
    setPosting(true);
    const resolvedMentions = await finalizeMentions(mentions, mentionQueryRef.current);
    setMentions(resolvedMentions);
    const payload: CreatePostData = {
      content: content.trim(),
      mentionUserIds: resolvedMentions.userIds.length ? resolvedMentions.userIds : undefined,
      mentionGymIds: resolvedMentions.gymIds.length ? resolvedMentions.gymIds : undefined,
      commentsLocked,
      repostsLocked,
    };
    if (mediaItems.length) {
      payload.mediaItems = toMediaPayload(mediaItems);
    }
    const created = await onPost(payload);
    setPosting(false);
    if (created) {
      setContent('');
      setMediaItems([]);
      setMentions({ userIds: [], gymIds: [], labels: [] });
      setCommentsLocked(false);
      setRepostsLocked(false);
    }
  };

  if (!canPost && disabledReason) {
    return (
      <div className="rounded-2xl border border-border bg-surface/60 p-4 text-sm text-muted text-center">
        {disabledReason}
      </div>
    );
  }

  return (
    <motion.div className="rounded-2xl border border-border bg-surface/80 p-4 space-y-3">
      <div className="flex gap-3">
        <UserAvatar
          avatarUrl={user?.profile?.avatarUrl}
          displayName={user?.profile?.displayName ?? user?.email?.split('@')[0]}
          className="size-11 rounded-full border border-primary/30 object-cover shrink-0"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          placeholder={placeholder}
          disabled={!canPost}
          className="flex-1 bg-transparent text-foreground placeholder:text-faint resize-none focus:outline-none text-sm disabled:opacity-50"
        />
      </div>
      <PostMediaEditor items={mediaItems} onChange={setMediaItems} onError={onError} disabled={!canPost} />
      <MentionPicker value={mentions} onChange={setMentions} queryRef={mentionQueryRef} />
      <div className="flex flex-wrap gap-3 text-xs text-muted">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={commentsLocked} onChange={(e) => setCommentsLocked(e.target.checked)} />
          {t('community.lockComments')}
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={repostsLocked} onChange={(e) => setRepostsLocked(e.target.checked)} />
          {t('community.lockReposts')}
        </label>
      </div>
      <div className="flex items-center justify-end pt-1 border-t border-subtle">
        <button
          type="button"
          onClick={submitPost}
          disabled={!canSubmit || posting || !canPost}
          className="flex items-center gap-2 bg-primary text-white font-bold px-5 py-2 rounded-full text-sm disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg">send</span>
          {posting ? '…' : t('community.post')}
        </button>
      </div>
    </motion.div>
  );
};
