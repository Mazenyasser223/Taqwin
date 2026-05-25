import React, { useCallback, useEffect, useRef, useState } from 'react';
import communityService from '../../services/communityService';
import uploadService from '../../services/uploadService';
import type { StoryAuthorBundle } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { useCommunityStoryViewerStore } from '../../store/useCommunityStoryViewerStore';
import { displayName, fallbackAvatar } from './communityUtils';
import { resolveMediaUrl } from '../../lib/mediaUrl';
import { useI18n } from '../../lib/i18n/useI18n';
import { feedPanel } from './communityFeedStyles';
import { UploadProgressBar } from '../../components/ui/UploadProgressBar';
import { peekCommunityStories } from '../../lib/communityCache';

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
  const barRef = useRef<HTMLDivElement>(null);

  const [storiesLoading, setStoriesLoading] = useState(() => peekCommunityStories() == null);

  const load = useCallback((opts?: { silent?: boolean }) => {
    const cached = peekCommunityStories();
    if (cached) {
      setBundles(cached);
      if (!opts?.silent) setStoriesLoading(false);
    }
    return communityService.getStoriesFeed().then((res) => {
      setBundles(res.data ?? []);
      setStoriesLoading(false);
    });
  }, []);

  useEffect(() => {
    const cached = peekCommunityStories();
    if (cached) setBundles(cached);
    load({ silent: Boolean(cached) });
  }, [load]);

  useEffect(() => {
    if (refreshRef) refreshRef.current = load;
    return () => {
      if (refreshRef) refreshRef.current = null;
    };
  }, [load, refreshRef]);

  const addStory = async (file: File) => {
    setUploading(true);
    setUploadPercent(0);
    const isVideo = file.type.startsWith('video/');
    const { url, error } = await uploadService.uploadFile(file, 'stories', setUploadPercent);
    setUploading(false);
    setUploadPercent(0);
    if (error || !url) return;
    await communityService.createStory(url, isVideo ? 'video' : 'image');
    load();
  };

  const openBundleStory = (bundle: StoryAuthorBundle, index: number, anchorEl?: HTMLElement | null) => {
    const anchor = anchorEl?.getBoundingClientRect() ?? null;
    openStory(bundle, index, anchor);
  };

  useEffect(() => {
    if (!openStoryUserId || bundles.length === 0) return;
    const bundle = bundles.find((b) => b.author.id === openStoryUserId);
    if (bundle?.stories?.length) {
      openBundleStory(bundle, 0);
      onOpenStoryConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once when param + bundles ready
  }, [openStoryUserId, bundles]);

  return (
    <div ref={barRef} className={`${feedPanel} px-3 py-3 relative`}>
        {uploading && (
          <div className="mb-3">
            <UploadProgressBar percent={uploadPercent} />
          </div>
        )}
        <div className="flex gap-4 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="shrink-0 flex flex-col items-center gap-1"
        >
          <div className="size-16 rounded-full border-2 border-dashed border-primary/50 flex items-center justify-center bg-primary/10 hover:bg-primary/15 transition-colors">
            <span className="material-symbols-outlined text-primary">{uploading ? 'hourglass_empty' : 'add'}</span>
          </div>
          <span className="text-[10px] font-semibold text-muted">{t('community.addStory')}</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/mp4,video/webm"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) addStory(f);
            e.target.value = '';
          }}
        />
        {storiesLoading &&
          bundles.length === 0 &&
          Array.from({ length: 5 }).map((_, i) => (
            <div key={`sk-${i}`} className="shrink-0 flex flex-col items-center gap-1">
              <div className="size-16 rounded-full skeleton-bone" />
              <div className="h-2 w-10 rounded skeleton-bone" />
            </div>
          ))}
        {bundles.map((b) => (
          <button
            key={b.author.id}
            type="button"
            onClick={(e) => openBundleStory(b, 0, e.currentTarget)}
            className="shrink-0 flex flex-col items-center gap-1"
          >
            <div
              className={`size-16 rounded-full p-0.5 ${
                b.hasUnseen ? 'bg-gradient-to-tr from-primary via-amber-400 to-pink-500' : 'border-2 border-subtle'
              }`}
            >
              <img
                src={resolveMediaUrl(b.author.profile?.avatarUrl) || fallbackAvatar(b.author.id)}
                alt=""
                className="size-full rounded-full object-cover border-2 border-background"
              />
            </div>
            <span className="text-[10px] font-semibold text-muted/90 max-w-[4rem] truncate">
              {b.author.id === user?.id ? t('community.yourStory') : displayName(b.author)}
            </span>
          </button>
        ))}
        </div>
    </div>
  );
};
