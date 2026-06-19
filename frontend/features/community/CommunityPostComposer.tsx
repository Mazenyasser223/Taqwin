import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import type { CommunityPost } from '../../types';
import type { CreatePostData } from '../../services/communityService';
import { useAuthStore } from '../../store/useAuthStore';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { MentionPicker, finalizeMentions, type MentionSelection } from './MentionPicker';
import {
  PostMediaEditor,
  PostMediaAttachButtons,
  usePostMediaUpload,
  toMediaPayload,
  type DraftMediaItem,
} from './PostMediaEditor';
import { EmojiComposer } from './EmojiComposer';
import { PollComposer, defaultPollOptions, validPollOptions } from './PollComposer';
import {
  feedComposerInput,
  feedPanel,
  composerToolbarBtn,
  composerToolbarBtnActive,
  composerToolbarDivider,
  composerToolbarRow,
} from './communityFeedStyles';
import { UploadProgressBar } from '../../components/ui/UploadProgressBar';

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
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollOptions, setPollOptions] = useState(defaultPollOptions);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const mentionQueryRef = useRef('');
  const emojiBtnRef = useRef<HTMLButtonElement>(null);

  const mediaUpload = usePostMediaUpload(mediaItems, setMediaItems, onError);
  const pollLabels = pollEnabled ? validPollOptions(pollOptions) : [];
  const mediaDisabled = !canPost || pollEnabled;
  const canSubmit =
    (pollEnabled ? content.trim().length > 0 && pollLabels.length >= 2 : false) ||
    content.trim().length > 0 ||
    mediaItems.length > 0;

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
    if (pollEnabled && pollLabels.length >= 2) {
      payload.poll = { options: pollLabels };
    }
    const created = await onPost(payload);
    setPosting(false);
    if (created) {
      setContent('');
      setMediaItems([]);
      setMentions({ userIds: [], gymIds: [], labels: [] });
      setCommentsLocked(false);
      setRepostsLocked(false);
      setPollEnabled(false);
      setPollOptions(defaultPollOptions());
      setEmojiPickerOpen(false);
    }
  };

  if (!canPost && disabledReason) {
    return (
      <div className={`${feedPanel} p-4 text-sm text-muted text-center`}>
        {disabledReason}
      </div>
    );
  }

  return (
    <motion.div className={`${feedPanel} overflow-hidden min-w-0 max-w-full`}>
      <div className="p-3 sm:p-4 space-y-3">
        <div className="flex gap-3 min-w-0">
          <UserAvatar
            avatarUrl={user?.profile?.communityAvatarUrl}
            displayName={user?.profile?.displayName ?? user?.email?.split('@')[0]}
            className="size-9 sm:size-11 rounded-full object-cover shrink-0 ring-2 ring-primary/20 mt-0.5"
          />
          <div className="flex-1 min-w-0 space-y-3">
            <EmojiComposer
              value={content}
              onChange={setContent}
              placeholder={placeholder}
              disabled={!canPost}
              multiline
              rows={3}
              showEmojiButton={false}
              pickerOpen={emojiPickerOpen}
              onPickerOpenChange={setEmojiPickerOpen}
              pickerAnchorRef={emojiBtnRef}
              inputClassName={`${feedComposerInput} w-full`}
              className="w-full"
            />

            <PostMediaEditor
              items={mediaItems}
              onChange={setMediaItems}
              onError={onError}
              disabled={mediaDisabled}
              hideAttachButtons
            />

            {pollEnabled && (
              <PollComposer
                enabled={pollEnabled}
                onEnabledChange={(next) => {
                  setPollEnabled(next);
                  if (next && mediaItems.length) setMediaItems([]);
                }}
                options={pollOptions}
                onOptionsChange={setPollOptions}
                disabled={!canPost}
                variant="toolbar"
              />
            )}

            <MentionPicker value={mentions} onChange={setMentions} queryRef={mentionQueryRef} />

            {mediaUpload.uploading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <UploadProgressBar percent={mediaUpload.uploadPercent} phase={mediaUpload.uploadPhase} />
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-white/[0.06] bg-black/[0.12]">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 min-w-0">
          <div className={`${composerToolbarRow} flex-1 min-w-0`}>
            <PostMediaAttachButtons
              disabled={mediaDisabled}
              uploading={mediaUpload.uploading}
              imageRef={mediaUpload.imageRef}
              videoRef={mediaUpload.videoRef}
              onPickImages={(files) => void mediaUpload.uploadFiles(files, 'image')}
              onPickVideos={(files) => void mediaUpload.uploadFiles(files, 'video')}
              showLabels
            />

            <span className={composerToolbarDivider} aria-hidden />

            <PollComposer
              enabled={pollEnabled}
              onEnabledChange={(next) => {
                setPollEnabled(next);
                if (next && mediaItems.length) setMediaItems([]);
              }}
              options={pollOptions}
              onOptionsChange={setPollOptions}
              disabled={!canPost}
              variant="toolbar"
              showPanel={false}
            />

            <button
              ref={emojiBtnRef}
              type="button"
              disabled={!canPost}
              onClick={() => setEmojiPickerOpen((open) => !open)}
              className={emojiPickerOpen ? composerToolbarBtnActive : composerToolbarBtn}
              title={t('community.addEmoji')}
              aria-label={t('community.addEmoji')}
              aria-pressed={emojiPickerOpen}
            >
              <span className="material-symbols-outlined text-[1.2rem]">mood</span>
              <span className="hidden md:inline text-xs font-semibold">{t('community.addEmoji')}</span>
            </button>
          </div>

          <div className={`${composerToolbarRow} shrink-0`}>
            <button
              type="button"
              disabled={!canPost}
              onClick={() => setCommentsLocked((v) => !v)}
              className={commentsLocked ? composerToolbarBtnActive : composerToolbarBtn}
              title={t('community.lockComments')}
              aria-pressed={commentsLocked}
            >
              <span className="material-symbols-outlined text-[1.2rem]">
                {commentsLocked ? 'comments_disabled' : 'chat'}
              </span>
              <span className="hidden lg:inline text-xs font-semibold">{t('community.lockComments')}</span>
            </button>
            <button
              type="button"
              disabled={!canPost}
              onClick={() => setRepostsLocked((v) => !v)}
              className={repostsLocked ? composerToolbarBtnActive : composerToolbarBtn}
              title={t('community.lockReposts')}
              aria-pressed={repostsLocked}
            >
              <span className="relative inline-flex shrink-0 items-center justify-center size-[1.2rem]">
                <span className="material-symbols-outlined text-[1.2rem] leading-none">repeat</span>
                {repostsLocked ? (
                  <span
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    aria-hidden
                  >
                    <span className="block h-px w-[140%] bg-current opacity-90 rotate-[-45deg]" />
                  </span>
                ) : null}
              </span>
              <span className="hidden lg:inline text-xs font-semibold">{t('community.lockReposts')}</span>
            </button>

            <button
              type="button"
              onClick={submitPost}
              disabled={!canSubmit || posting || !canPost || mediaUpload.uploading}
              className="inline-flex items-center justify-center gap-1.5 h-9 sm:h-10 px-4 sm:px-5 rounded-full bg-primary text-white text-xs sm:text-sm font-bold shadow-lg shadow-primary/25 hover:brightness-110 transition-all disabled:opacity-45 disabled:shadow-none disabled:pointer-events-none"
            >
              <span className="material-symbols-outlined text-[1.15rem] sm:text-[1.25rem]">send</span>
              <span>
                {posting
                  ? mediaItems.some((m) => m.mediaType === 'video')
                    ? t('community.checkingVideo')
                    : '…'
                  : t('community.post')}
              </span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
