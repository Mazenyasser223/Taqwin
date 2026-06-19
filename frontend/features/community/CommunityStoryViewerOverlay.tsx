import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import communityService from '../../services/communityService';
import type { StoryViewer } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { useCommunityStoryViewerStore, useStoryViewerSlice } from '../../store/useCommunityStoryViewerStore';
import { useCommunityStoriesStore } from '../../store/useCommunityStoriesStore';
import { displayName, communityAvatarUrl, communityProfilePath } from './communityUtils';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { resolveMediaUrl } from '../../lib/mediaUrl';
import { useI18n } from '../../lib/i18n/useI18n';
import { StoryReactionPicker } from './StoryReactionPicker';
import type { ReactionEmoji } from './reactions';
import { reactionSymbol } from './reactions';

const STORY_DURATION_MS = 5000;

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

type AnchorRect = Pick<DOMRect, 'top' | 'left' | 'right' | 'bottom' | 'width' | 'height'>;

function computeFrameLayout(anchorRect: AnchorRect | DOMRect | null): {
  top: number;
  left: number;
  width: number;
  height: number;
} {
  const pad = 12;
  const gap = 10;
  const maxW = window.innerWidth - pad * 2;
  let height = Math.min(window.innerHeight * 0.78, maxW * (16 / 9), 620);
  let width = height * (9 / 16);
  if (width > maxW) {
    width = maxW;
    height = width * (16 / 9);
  }
  width = Math.min(width, 380);
  height = Math.min(height, window.innerHeight - pad * 2);

  if (!anchorRect) {
    return {
      top: Math.max(pad, (window.innerHeight - height) / 2),
      left: Math.max(pad, (window.innerWidth - width) / 2),
      width,
      height,
    };
  }

  let top = anchorRect.top + anchorRect.height / 2 - height / 2;
  top = Math.max(pad, Math.min(top, window.innerHeight - height - pad));

  let left = anchorRect.right + gap;
  if (left + width > window.innerWidth - pad) {
    left = anchorRect.left - width - gap;
  }
  if (left < pad || left + width > window.innerWidth - pad) {
    left = anchorRect.left + anchorRect.width / 2 - width / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - width - pad));
  }

  return { top, left, width, height };
}

export const CommunityStoryViewerOverlay: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const { viewer, storyIndex, playToken, currentStory, anchorRect } = useStoryViewerSlice();
  const close = useCommunityStoryViewerStore((s) => s.close);
  const goToStoryIndex = useCommunityStoryViewerStore((s) => s.goToStoryIndex);

  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<StoryViewer[]>([]);
  const [replyDraft, setReplyDraft] = useState('');
  const [progress, setProgress] = useState(0);
  const [timerPaused, setTimerPaused] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [videoNeedsTap, setVideoNeedsTap] = useState(false);
  const [storyMuted, setStoryMuted] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [resharing, setResharing] = useState(false);
  const [reshareDone, setReshareDone] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerStartRef = useRef(0);
  const rafRef = useRef<number>(0);
  const [framePos, setFramePos] = useState<ReturnType<typeof computeFrameLayout> | null>(null);

  const isOwnStory = viewer?.bundle.author.id === user?.id;
  const mediaSrc = currentStory
    ? `${resolveMediaUrl(currentStory.mediaUrl)}${currentStory.mediaUrl.includes('?') ? '&' : '?'}_story=${currentStory.id}`
    : '';

  const tryPlayVideo = useCallback(async (preferSound = true) => {
    const v = videoRef.current;
    if (!v || currentStory?.mediaType !== 'video') return;

    const playWithMute = async (muted: boolean) => {
      v.muted = muted;
      setStoryMuted(muted);
      await v.play();
    };

    try {
      if (preferSound) {
        await playWithMute(false);
      } else {
        await playWithMute(true);
      }
      setVideoNeedsTap(false);
    } catch {
      if (preferSound) {
        try {
          await playWithMute(true);
          setVideoNeedsTap(false);
        } catch {
          setVideoNeedsTap(true);
        }
      } else {
        setVideoNeedsTap(true);
      }
    }
  }, [currentStory?.mediaType]);

  const toggleStorySound = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const v = videoRef.current;
      if (!v) return;
      const nextMuted = !storyMuted;
      v.muted = nextMuted;
      setStoryMuted(nextMuted);
      if (!nextMuted) {
        void v.play().catch(() => setVideoNeedsTap(true));
      }
    },
    [storyMuted],
  );

  const closeViewer = useCallback(() => {
    if (viewer) {
      useCommunityStoriesStore.getState().markAuthorStoriesSeen(
        viewer.bundle.author.id,
        storyIndex,
        user?.id,
      );
    }
    close();
  }, [viewer, storyIndex, user?.id, close]);

  const goNext = useCallback(() => {
    if (!viewer || storyIndex < 0) return;
    const next = storyIndex + 1;
    if (next >= viewer.bundle.stories.length) {
      useCommunityStoriesStore.getState().markAuthorStoriesSeen(
        viewer.bundle.author.id,
        storyIndex,
        user?.id,
      );
      close();
      return;
    }
    goToStoryIndex(next);
  }, [viewer, storyIndex, close, goToStoryIndex, user?.id]);

  const goPrev = useCallback(() => {
    if (!viewer || storyIndex <= 0) return;
    goToStoryIndex(storyIndex - 1);
  }, [viewer, storyIndex, goToStoryIndex]);

  useEffect(() => {
    if (!viewer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [viewer]);

  useEffect(() => {
    if (!viewer) {
      setFramePos(null);
      return;
    }
    const update = () => setFramePos(computeFrameLayout(anchorRect));
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [viewer, anchorRect]);

  useEffect(() => {
    if (!viewer || !currentStory) return;
    setReplyDraft('');
    setViewersOpen(false);
    setProgress(0);
    setVideoError(false);
    setVideoNeedsTap(false);
    setStoryMuted(true);
    setReshareDone(false);
  }, [currentStory?.id, currentStory?.myReaction, viewer]);

  useEffect(() => {
    if (!viewer || !currentStory || viewersOpen || timerPaused) return;
    if (currentStory.mediaType === 'video') return;

    timerStartRef.current = performance.now();
    const tick = (now: number) => {
      const elapsed = now - timerStartRef.current;
      const p = Math.min(1, elapsed / STORY_DURATION_MS);
      setProgress(p);
      if (p >= 1) {
        goNext();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [storyIndex, currentStory?.id, currentStory?.mediaType, viewersOpen, timerPaused, goNext]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || currentStory?.mediaType !== 'video') return;
    if (timerPaused || viewersOpen) v.pause();
    else void tryPlayVideo(true);
  }, [timerPaused, viewersOpen, currentStory?.id, currentStory?.mediaType, mediaSrc, tryPlayVideo]);

  const reactToStory = async (emoji: ReactionEmoji) => {
    if (!currentStory || !viewer || isOwnStory) return;
    const same = currentStory.myReaction === emoji;
    if (same) await communityService.unreactStory(currentStory.id);
    else await communityService.reactStory(currentStory.id, emoji);
    const nextReaction = same ? null : emoji;
    useCommunityStoryViewerStore.setState({
      viewer: {
        ...viewer,
        bundle: {
          ...viewer.bundle,
          stories: viewer.bundle.stories.map((s) =>
            s.id === currentStory.id ? { ...s, myReaction: nextReaction } : s,
          ),
        },
      },
    });
  };

  const sendReply = async () => {
    if (!currentStory || !replyDraft.trim()) return;
    await communityService.replyToStory(currentStory.id, replyDraft.trim());
    setReplyDraft('');
    void communityService.refreshStoriesFeed();
  };

  const showViewers = async () => {
    if (!currentStory) return;
    const res = await communityService.getStoryViewers(currentStory.id);
    setViewers(res.data ?? []);
    setViewersOpen(true);
  };

  const reshareToMyStory = async () => {
    if (!currentStory?.canReshare || resharing || reshareDone) return;
    setResharing(true);
    const res = await communityService.reshareStory(currentStory.id);
    setResharing(false);
    if (res.error) {
      window.alert(res.error);
      return;
    }
    setReshareDone(true);
    void communityService.refreshStoriesFeed();
    useCommunityStoryViewerStore.setState((state) => {
      if (!state.viewer) return state;
      return {
        viewer: {
          ...state.viewer,
          bundle: {
            ...state.viewer.bundle,
            stories: state.viewer.bundle.stories.map((s) =>
              s.id === currentStory.id ? { ...s, canReshare: false } : s,
            ),
          },
        },
      };
    });
  };

  const deleteCurrentStory = async () => {
    if (!currentStory || !viewer || !isOwnStory || deleting) return;
    if (!window.confirm(t('community.storyDeleteConfirm'))) return;

    setDeleting(true);
    setTimerPaused(true);
    const res = await communityService.deleteStory(currentStory.id);
    setDeleting(false);

    if (res.error) {
      window.alert(res.error || t('community.storyDeleteFailed'));
      setTimerPaused(false);
      return;
    }

    const remaining = viewer.bundle.stories.filter((s) => s.id !== currentStory.id);
    void communityService.refreshStoriesFeed();

    if (remaining.length === 0) {
      close();
      return;
    }

    const nextIndex = Math.min(storyIndex, remaining.length - 1);
    useCommunityStoryViewerStore.setState({
      viewer: {
        ...viewer,
        index: nextIndex,
        playToken: viewer.playToken + 1,
        bundle: { ...viewer.bundle, stories: remaining },
      },
    });
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {viewer && currentStory && framePos && (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label={t('common.close')}
            className="fixed inset-0 z-[199] cursor-default bg-black/25 border-0 p-0"
            onClick={closeViewer}
          />
          <motion.div
            key={`${currentStory.id}-${storyIndex}-${playToken}`}
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.15 }}
            className="fixed z-[200] rounded-2xl overflow-hidden bg-zinc-950 shadow-2xl ring-1 ring-white/15"
            style={{
              top: framePos.top,
              left: framePos.left,
              width: framePos.width,
              height: framePos.height,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Media layer */}
            <div key={`${currentStory.id}-${playToken}`} className="absolute inset-0 z-0 flex items-center justify-center bg-zinc-950">
              {currentStory.mediaType === 'video' ? (
                <>
                  <video
                    ref={videoRef}
                    key={currentStory.id}
                    src={mediaSrc ?? undefined}
                    autoPlay
                    muted={storyMuted}
                    playsInline
                    preload="auto"
                    className="max-w-full max-h-full w-full h-full object-contain"
                    onTimeUpdate={(e) => {
                      const v = e.currentTarget;
                      if (v.duration && Number.isFinite(v.duration)) {
                        setProgress(v.currentTime / v.duration);
                      }
                    }}
                    onLoadedData={() => {
                      if (!timerPaused && !viewersOpen) void tryPlayVideo(true);
                    }}
                    onError={() => setVideoError(true)}
                    onEnded={goNext}
                  />
                  {(videoError || videoNeedsTap) && (
                    <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 px-4 text-white pointer-events-none">
                      <span className="material-symbols-outlined text-4xl">
                        {videoError ? 'videocam_off' : 'play_circle'}
                      </span>
                      <p className="text-xs text-center text-white/80">
                        {videoError ? t('community.storyVideoLoadFailed') : t('community.storyTapToPlay')}
                      </p>
                    </div>
                  )}
                  {videoNeedsTap && !videoError && (
                    <button
                      type="button"
                      className="absolute inset-0 z-[2] bg-transparent"
                      aria-label={t('community.storyTapToPlay')}
                      onClick={(e) => {
                        e.stopPropagation();
                        void tryPlayVideo(true);
                      }}
                    />
                  )}
                </>
              ) : (
                <img
                  key={`${currentStory.id}-${playToken}`}
                  src={mediaSrc || resolveMediaUrl(currentStory.mediaUrl)}
                  alt=""
                  className="max-w-full max-h-full w-full h-full object-contain pointer-events-none"
                />
              )}
            </div>

            {/* Left tap zone — go to previous photo */}
            {storyIndex > 0 && (
              <button
                type="button"
                className="absolute left-0 top-0 h-full w-[38%] z-[5] bg-transparent"
                aria-label="Previous story"
                onClick={goPrev}
              />
            )}
            {/* Right tap zone — go to next photo */}
            <button
              type="button"
              className="absolute right-0 top-0 h-full w-[62%] z-[5] bg-transparent"
              aria-label={t('community.storyNext')}
              onClick={goNext}
            />

            <div className="absolute top-0 left-0 right-0 z-10 pt-3 px-3 pb-6 bg-gradient-to-b from-black/75 to-transparent pointer-events-none">
              <div className="flex gap-1 mb-3 pointer-events-auto">
                {viewer.bundle.stories.map((s, i) => (
                  <div key={s.id} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-none"
                      style={{
                        width: i < storyIndex ? '100%' : i === storyIndex ? `${progress * 100}%` : '0%',
                      }}
                    />
                  </div>
                ))}
              </div>
              {currentStory.resharedFrom?.author && (
                <div className="mb-2 pointer-events-auto">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-white text-[11px] font-bold">
                    <span className="material-symbols-outlined text-sm">repeat</span>
                    {t('community.storyResharedVia', { name: displayName(currentStory.resharedFrom.author) })}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3 pointer-events-auto">
                <Link
                  to={communityProfilePath(viewer.bundle.author.id)}
                  className="flex items-center gap-2 min-w-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <UserAvatar
                    avatarUrl={communityAvatarUrl(viewer.bundle.author)}
                    displayName={viewer.bundle.author.profile?.displayName ?? displayName(viewer.bundle.author)}
                    email={viewer.bundle.author.email}
                    className="size-9 text-xs border border-white/20"
                    imgClassName="size-9 rounded-full object-cover border border-white/20"
                    alt={displayName(viewer.bundle.author)}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-white text-sm truncate">{displayName(viewer.bundle.author)}</span>
                    <span className="text-white/60 text-xs">{relativeTime(currentStory.createdAt)}</span>
                    {viewer.bundle.stories.length > 1 && (
                      <span className="text-white/50 text-[10px] font-bold tabular-nums">
                        {t('community.storyProgress', {
                          current: String(storyIndex + 1),
                          total: String(viewer.bundle.stories.length),
                        })}
                      </span>
                    )}
                  </div>
                </Link>
                {currentStory.mediaType === 'video' && (
                  <button
                    type="button"
                    onClick={toggleStorySound}
                    className="shrink-0 text-white p-1 rounded-full bg-white/10 border border-white/20 hover:bg-white/20"
                    title={storyMuted ? t('community.storyUnmute') : t('community.storyMute')}
                    aria-label={storyMuted ? t('community.storyUnmute') : t('community.storyMute')}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {storyMuted ? 'volume_off' : 'volume_up'}
                    </span>
                  </button>
                )}
                <button type="button" onClick={closeViewer} className="ml-auto text-white p-1 shrink-0">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {(currentStory.caption?.trim() || (currentStory.mentions?.length ?? 0) > 0) && (
              <div className="absolute bottom-24 left-0 right-0 z-[6] px-4 pointer-events-none">
                {currentStory.mentions && currentStory.mentions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {currentStory.mentions.map((m) =>
                      m.type === 'user' && m.user ? (
                        <Link
                          key={m.id}
                          to={communityProfilePath(m.user.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="pointer-events-auto text-xs font-bold text-white bg-primary/80 px-2 py-0.5 rounded-lg"
                        >
                          @{displayName(m.user)}
                        </Link>
                      ) : null,
                    )}
                  </div>
                )}
                {currentStory.caption?.trim() && (
                  <p className="text-white text-sm font-medium drop-shadow-lg whitespace-pre-wrap break-words">
                    {currentStory.caption}
                  </p>
                )}
              </div>
            )}

            <div
              className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-3 pt-6 bg-gradient-to-t from-black/85 via-black/45 to-transparent"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-1.5 w-full min-w-0 pointer-events-auto">
                {isOwnStory && (
                  <>
                    <button
                      type="button"
                      onClick={showViewers}
                      className="shrink-0 flex items-center gap-1 text-white font-bold px-2.5 py-2 rounded-full bg-white/15 border border-white/20 hover:bg-white/25"
                      title={t('community.storyViewers')}
                      aria-label={t('community.storyViewers')}
                    >
                      <span className="material-symbols-outlined text-lg">visibility</span>
                      <span className="text-xs tabular-nums">{currentStory.viewCount ?? 0}</span>
                    </button>
                    <button
                      type="button"
                      onClick={deleteCurrentStory}
                      disabled={deleting}
                      className="shrink-0 size-10 flex items-center justify-center text-white rounded-full bg-red-500/20 border border-red-400/30 hover:bg-red-500/30 disabled:opacity-50 ms-auto"
                      title={t('community.storyDelete')}
                      aria-label={t('community.storyDelete')}
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </>
                )}
                {!isOwnStory && (
                  <>
                    {currentStory.canReshare && (
                      <button
                        type="button"
                        onClick={() => void reshareToMyStory()}
                        disabled={resharing || reshareDone}
                        className="shrink-0 size-10 flex items-center justify-center text-white rounded-full bg-white/15 border border-white/20 hover:bg-white/25 disabled:opacity-50"
                        title={
                          reshareDone
                            ? t('community.storyAddedToYours')
                            : resharing
                              ? t('community.posting')
                              : t('community.storyAddToYours')
                        }
                        aria-label={t('community.storyAddToYours')}
                      >
                        <span className="material-symbols-outlined text-lg">
                          {reshareDone ? 'check' : 'repeat'}
                        </span>
                      </button>
                    )}
                    <StoryReactionPicker
                      myReaction={currentStory.myReaction}
                      onReact={reactToStory}
                      compact
                    />
                    <div className="flex flex-1 min-w-0 items-center gap-1.5">
                      <input
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                        onFocus={() => setTimerPaused(true)}
                        onBlur={() => setTimerPaused(false)}
                        placeholder={t('community.storyReplyPlaceholder')}
                        className="flex-1 min-w-0 w-0 rounded-full bg-white/15 border border-white/25 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      <button
                        type="button"
                        onClick={sendReply}
                        disabled={!replyDraft.trim()}
                        className="shrink-0 size-10 flex items-center justify-center rounded-full bg-primary text-white disabled:opacity-40"
                        title={t('community.reply')}
                        aria-label={t('community.reply')}
                      >
                        <span className="material-symbols-outlined text-lg">send</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <AnimatePresence>
              {viewersOpen && (
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  className="absolute inset-x-0 bottom-0 max-h-[55%] rounded-t-2xl bg-surface border-t border-border overflow-hidden flex flex-col z-30"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-3 border-b border-subtle flex items-center justify-between">
                    <h3 className="font-black text-sm">{t('community.storyViewers')}</h3>
                    <button type="button" onClick={() => setViewersOpen(false)}>
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                  <div className="overflow-y-auto p-3 space-y-2">
                    {viewers.length === 0 && (
                      <p className="text-sm text-muted text-center py-4">{t('community.storyNoViewers')}</p>
                    )}
                    {viewers.map((v) => (
                      <Link
                        key={v.id}
                        to={communityProfilePath(v.user.id)}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-elevated"
                        onClick={() => setViewersOpen(false)}
                      >
                        <UserAvatar
                          avatarUrl={communityAvatarUrl(v.user)}
                          displayName={v.user.profile?.displayName ?? displayName(v.user)}
                          email={v.user.email}
                          className="size-10 text-sm"
                          imgClassName="size-10 rounded-full object-cover shrink-0"
                          alt={displayName(v.user)}
                        />
                        <span className="font-bold text-sm flex-1 min-w-0 truncate">{displayName(v.user)}</span>
                        {v.reactionEmoji && (
                          <span className="text-xl shrink-0" title={t('community.storyReacted')}>
                            {reactionSymbol(v.reactionEmoji)}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
};
