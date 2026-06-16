import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import communityService from '../../services/communityService';
import uploadService from '../../services/uploadService';
import type { StoryAuthorBundle } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { useCommunityStoryViewerStore } from '../../store/useCommunityStoryViewerStore';
import { displayName, communityAvatarUrl, isVideoMediaFile } from './communityUtils';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { useI18n } from '../../lib/i18n/useI18n';
import { feedPanel } from './communityFeedStyles';
import { UploadProgressBar } from '../../components/ui/UploadProgressBar';
import { useCommunityStoriesStore } from '../../store/useCommunityStoriesStore';
import { peekCommunityStories } from '../../lib/communityCache';
import { useCommunityLivePoll, COMMUNITY_STORIES_POLL_MS } from './useCommunityLivePoll';
import { useRealtimeStore } from '../../lib/realtime/useRealtimeStore';
import { sortStoryBundles } from './storyBundles';
import { StoryComposerModal, type StoryComposerDraft } from './StoryComposerModal';

interface CommunityStoriesBarProps {
  refreshRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  /** Auto-open this user's story once bundles are loaded (e.g. from profile). */
  openStoryUserId?: string | null;
  onOpenStoryConsumed?: () => void;
}

export const CommunityStoriesBar: React.FC<CommunityStoriesBarProps> = ({
  refreshRef,
  openStoryUserId,
  onOpenStoryConsumed,
}) => {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const openStory = useCommunityStoryViewerStore((s) => s.openStory);
  const [bundles, setBundles] = useState<StoryAuthorBundle[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<'upload' | 'processing'>('upload');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [storyDraft, setStoryDraft] = useState<StoryComposerDraft | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const savedScrollLeft = useRef(0);

  const applyBundles = useCallback(
    (data: StoryAuthorBundle[]) => {
      const sorted = sortStoryBundles(data, user?.id);
      setBundles(sorted);
      useCommunityStoriesStore.getState().setBundles(sorted, user?.id);
    },
    [user?.id],
  );

  const isModerationError = (message: string) =>
    /not allowed|لا يُسمح|inappropriate|مسيء|تحرش|violates|profan|content_moderated/i.test(message);

  useEffect(() => {
    if (!uploadError) return;
    if (!isModerationError(uploadError)) return;
    const timer = window.setTimeout(() => setUploadError(null), 5000);
    return () => window.clearTimeout(timer);
  }, [uploadError]);

  const [storiesLoading, setStoriesLoading] = useState(() => peekCommunityStories() == null);

  const load = useCallback((opts?: { silent?: boolean; fresh?: boolean }) => {
    const cached = peekCommunityStories();
    if (cached && !opts?.fresh) {
      applyBundles(cached);
      if (!opts?.silent) setStoriesLoading(false);
    }
    const fetcher = opts?.fresh
      ? () => communityService.refreshStoriesFeed()
      : () => communityService.getStoriesFeed();
    return fetcher().then((res) => {
      applyBundles(res.data ?? []);
      setStoriesLoading(false);
    });
  }, [applyBundles]);

  useCommunityLivePoll(
    () =>
      communityService.revalidateStoriesFeed((data) => {
        applyBundles(data);
      }),
    COMMUNITY_STORIES_POLL_MS,
    true,
    false,
  );

  const subscribe = useRealtimeStore((s) => s.subscribe);
  useEffect(() => {
    return subscribe('community.story.new', () => {
      void load({ silent: true, fresh: true });
    });
  }, [subscribe, load]);

  useEffect(() => {
    const cached = peekCommunityStories();
    if (cached) applyBundles(cached);
    load({ silent: Boolean(cached) });
  }, [load, applyBundles]);

  const storeBundles = useCommunityStoriesStore((s) => s.bundles);
  useEffect(() => {
    if (storeBundles.length === 0) return;
    savedScrollLeft.current = scrollRef.current?.scrollLeft ?? savedScrollLeft.current;
    setBundles(storeBundles);
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollLeft = savedScrollLeft.current;
    });
  }, [storeBundles]);

  useEffect(() => {
    if (refreshRef) refreshRef.current = () => load({ silent: true, fresh: true });
    return () => {
      if (refreshRef) refreshRef.current = null;
    };
  }, [load, refreshRef]);

  const closeStoryDraft = () => {
    if (storyDraft?.previewUrl) URL.revokeObjectURL(storyDraft.previewUrl);
    setStoryDraft(null);
  };

  const publishStory = async (payload: { caption: string; mentionUserIds: string[] }) => {
    if (!storyDraft) return;
    setUploading(true);
    setUploadPercent(0);
    setUploadPhase('upload');
    setUploadError(null);
    const isVideo = isVideoMediaFile(storyDraft.file);
    const { url, error } = await uploadService.uploadFile(storyDraft.file, 'stories', (p, phase) => {
      if (phase) setUploadPhase(phase);
      setUploadPercent(p);
    });
    if (error || !url) {
      setUploading(false);
      setUploadPercent(0);
      setUploadPhase('upload');
      setUploadError(error ?? t('community.storyUploadFailed'));
      return;
    }
    const created = await communityService.createStory(url, isVideo ? 'video' : 'image', {
      caption: payload.caption || undefined,
      mentionUserIds: payload.mentionUserIds.length ? payload.mentionUserIds : undefined,
    });
    setUploading(false);
    setUploadPercent(0);
    setUploadPhase('upload');
    if (created.error) {
      setUploadError(created.error);
      return;
    }
    closeStoryDraft();
    load();
  };

  const pickStoryFile = (file: File) => {
    closeStoryDraft();
    setStoryDraft({ file, previewUrl: URL.createObjectURL(file) });
  };

  const openBundleStory = (bundle: StoryAuthorBundle, index: number, anchorEl?: HTMLElement | null) => {
    const anchor = anchorEl?.getBoundingClientRect() ?? null;
    const start = index >= 0 ? index : bundle.stories.findIndex((s) => !s.seen);
    openStory(bundle, start >= 0 ? start : 0, anchor);
  };

  const consumedOpenStoryRef = useRef<string | null>(null);
  useEffect(() => {
    if (!openStoryUserId) {
      consumedOpenStoryRef.current = null;
      return;
    }
    if (bundles.length === 0) return;
    if (consumedOpenStoryRef.current === openStoryUserId) return;
    const bundle = bundles.find((b) => b.author.id === openStoryUserId);
    if (bundle?.stories?.length) {
      consumedOpenStoryRef.current = openStoryUserId;
      openBundleStory(bundle, -1);
      onOpenStoryConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once per URL param, not on every poll
  }, [openStoryUserId, bundles.length]);

  return (
    <div ref={barRef} className={`${feedPanel} px-2 sm:px-3 py-3 relative max-w-full min-w-0 overflow-hidden`}>
        {uploading && (
          <div className="mb-3">
            <UploadProgressBar percent={uploadPercent} phase={uploadPhase} />
          </div>
        )}
        <AnimatePresence>
          {uploadError && (
            <motion.div
              key={uploadError}
              role="alert"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="mb-3 p-4 rounded-xl bg-red-500/10 text-red-400 text-sm flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <span className="material-symbols-outlined text-xl shrink-0">
                  {isModerationError(uploadError) ? 'error' : 'warning'}
                </span>
                <p className="leading-relaxed">{uploadError}</p>
              </div>
              <button
                type="button"
                onClick={() => setUploadError(null)}
                className="shrink-0 px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 font-bold text-xs transition-colors"
              >
                {t('common.close')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={scrollRef} className="flex gap-4 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="shrink-0 flex flex-col items-center gap-1"
        >
          <div className="size-12 sm:size-16 rounded-full border-2 border-dashed border-primary/50 flex items-center justify-center bg-primary/10 hover:bg-primary/15 transition-colors">
            <span className="material-symbols-outlined text-primary">{uploading ? 'hourglass_empty' : 'add'}</span>
          </div>
          <span className="text-[10px] font-semibold text-muted">{t('community.addStory')}</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pickStoryFile(f);
            e.target.value = '';
          }}
        />
        {storiesLoading &&
          bundles.length === 0 &&
          Array.from({ length: 5 }).map((_, i) => (
            <div key={`sk-${i}`} className="shrink-0 flex flex-col items-center gap-1">
              <div className="size-12 sm:size-16 rounded-full skeleton-bone" />
              <div className="h-2 w-10 rounded skeleton-bone" />
            </div>
          ))}
        {bundles.map((b) => (
          <button
            key={b.author.id}
            type="button"
            onClick={(e) => openBundleStory(b, -1, e.currentTarget)}
            className="shrink-0 flex flex-col items-center gap-1"
          >
            <div
              className={`size-12 sm:size-16 rounded-full p-0.5 ${
                b.hasUnseen ? 'bg-gradient-to-tr from-primary via-amber-400 to-pink-500' : 'border-2 border-subtle'
              }`}
            >
              <UserAvatar
                avatarUrl={communityAvatarUrl(b.author)}
                displayName={b.author.profile?.displayName ?? displayName(b.author)}
                email={b.author.email}
                className="size-full text-xs sm:text-sm border-2 border-background"
                imgClassName="size-full rounded-full object-cover border-2 border-background"
                alt={b.author.id === user?.id ? t('community.yourStory') : displayName(b.author)}
              />
            </div>
            <span className="text-[10px] font-semibold text-muted/90 max-w-[4rem] truncate">
              {b.author.id === user?.id ? t('community.yourStory') : displayName(b.author)}
            </span>
          </button>
        ))}
        </div>
        {storyDraft && (
          <StoryComposerModal
            draft={storyDraft}
            uploading={uploading}
            uploadPercent={uploadPercent}
            uploadPhase={uploadPhase}
            onClose={closeStoryDraft}
            onSubmit={(payload) => void publishStory(payload)}
          />
        )}
    </div>
  );
};
