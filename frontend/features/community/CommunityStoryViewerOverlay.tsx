import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import communityService from '../../services/communityService';
import type { StoryViewer } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { useCommunityStoryViewerStore } from '../../store/useCommunityStoryViewerStore';
import { displayName, fallbackAvatar, communityProfilePath } from './communityUtils';
import { useI18n } from '../../lib/i18n/useI18n';
import { StoryReactionPicker } from './StoryReactionPicker';
import type { ReactionEmoji } from './reactions';
import { reactionSymbol } from './reactions';

const STORY_DURATION_MS = 5000;

function computeFrameLayout(anchorRect: DOMRect | null): { top: number; left: number; width: number; height: number } {
  const pad = 12;
  const maxW = window.innerWidth - pad * 2;
  let height = Math.min(window.innerHeight * 0.72, maxW * (16 / 9), 520);
  let width = height * (9 / 16);
  if (width > maxW) {
    width = maxW;
    height = width * (16 / 9);
  }
  width = Math.min(width, 320);
  height = Math.min(height, window.innerHeight - pad * 2);

  let top = pad;
  let left = (window.innerWidth - width) / 2;

  if (anchorRect) {
    top = anchorRect.top;
    left = anchorRect.right + pad;
    if (left + width > window.innerWidth - pad) {
      left = anchorRect.left - width - pad;
    }
    if (left < pad) left = pad;
    if (top + height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - height - pad);
    }
  }

  return { top, left, width, height };
}

export const CommunityStoryViewerOverlay: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const viewer = useCommunityStoryViewerStore((s) => s.viewer);
  const anchorRect = useCommunityStoryViewerStore((s) => s.anchorRect);
  const close = useCommunityStoryViewerStore((s) => s.close);
  const setViewer = useCommunityStoryViewerStore((s) => s.openStory);

  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<StoryViewer[]>([]);
  const [replyDraft, setReplyDraft] = useState('');
  const [progress, setProgress] = useState(0);
  const [timerPaused, setTimerPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerStartRef = useRef(0);
  const rafRef = useRef<number>(0);
  const [framePos, setFramePos] = useState<ReturnType<typeof computeFrameLayout> | null>(null);

  const currentStory = viewer ? viewer.bundle.stories[viewer.index] : null;
  const isOwnStory = viewer?.bundle.author.id === user?.id;

  const refreshBundles = useCallback(() => {
    void communityService.getStoriesFeed();
  }, []);

  const goNext = useCallback(() => {
    if (!viewer) return;
    const next = viewer.index + 1;
    if (next >= viewer.bundle.stories.length) {
      close();
      refreshBundles();
      return;
    }
    const story = viewer.bundle.stories[next];
    const anchor = useCommunityStoryViewerStore.getState().anchorRect;
    setViewer(viewer.bundle, next, anchor);
    if (story) void communityService.viewStory(story.id);
  }, [viewer, close, refreshBundles, setViewer]);

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
  }, [viewer?.index, currentStory?.id, currentStory?.mediaType, viewersOpen, timerPaused, goNext]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || currentStory?.mediaType !== 'video') return;
    if (timerPaused || viewersOpen) v.pause();
    else void v.play().catch(() => {});
  }, [timerPaused, viewersOpen, currentStory?.id, currentStory?.mediaType]);

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
    refreshBundles();
  };

  const showViewers = async () => {
    if (!currentStory) return;
    const res = await communityService.getStoryViewers(currentStory.id);
    setViewers(res.data ?? []);
    setViewersOpen(true);
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
            onClick={close}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="fixed z-[200] rounded-2xl overflow-hidden bg-zinc-950 shadow-2xl ring-1 ring-white/15"
            style={{
              top: framePos.top,
              left: framePos.left,
              width: framePos.width,
              height: framePos.height,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute inset-0 z-0 flex items-center justify-center bg-zinc-950"
              onClick={goNext}
              aria-label={t('community.storyNext')}
            >
              {currentStory.mediaType === 'video' ? (
                <video
                  ref={videoRef}
                  key={currentStory.id}
                  src={currentStory.mediaUrl}
                  autoPlay
                  playsInline
                  className="max-w-full max-h-full w-full h-full object-contain"
                  onTimeUpdate={(e) => {
                    const v = e.currentTarget;
                    if (v.duration && Number.isFinite(v.duration)) {
                      setProgress(v.currentTime / v.duration);
                    }
                  }}
                  onEnded={goNext}
                />
              ) : (
                <img
                  src={currentStory.mediaUrl}
                  alt=""
                  className="max-w-full max-h-full w-full h-full object-contain"
                />
              )}
            </button>

            <div className="absolute top-0 left-0 right-0 z-10 pt-3 px-3 pb-6 bg-gradient-to-b from-black/75 to-transparent pointer-events-none">
              <div className="flex gap-1 mb-3 pointer-events-auto">
                {viewer.bundle.stories.map((s, i) => (
                  <div key={s.id} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-none"
                      style={{
                        width: i < viewer.index ? '100%' : i === viewer.index ? `${progress * 100}%` : '0%',
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 pointer-events-auto">
                <Link
                  to={communityProfilePath(viewer.bundle.author.id)}
                  className="flex items-center gap-2 min-w-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    src={viewer.bundle.author.profile?.avatarUrl || fallbackAvatar(viewer.bundle.author.id)}
                    alt=""
                    className="size-9 rounded-full object-cover border border-white/20"
                  />
                  <span className="font-bold text-white text-sm truncate">{displayName(viewer.bundle.author)}</span>
                </Link>
                <button type="button" onClick={close} className="ml-auto text-white p-1 shrink-0">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            <div
              className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-4 pt-8 bg-gradient-to-t from-black/85 via-black/45 to-transparent"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 w-full pointer-events-auto">
                {isOwnStory && (
                  <button
                    type="button"
                    onClick={showViewers}
                    className="shrink-0 flex items-center gap-1.5 text-white font-bold px-3 py-2.5 rounded-full bg-white/15 border border-white/20 hover:bg-white/25"
                    title={t('community.storyViewers')}
                  >
                    <span className="material-symbols-outlined text-xl">visibility</span>
                    <span className="text-sm tabular-nums">{currentStory.viewCount ?? 0}</span>
                  </button>
                )}
                {!isOwnStory && (
                  <>
                    <StoryReactionPicker myReaction={currentStory.myReaction} onReact={reactToStory} />
                    <input
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                      onFocus={() => setTimerPaused(true)}
                      onBlur={() => setTimerPaused(false)}
                      placeholder={t('community.storyReplyPlaceholder')}
                      className="flex-1 min-w-0 rounded-full bg-white/15 border border-white/25 px-4 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <button
                      type="button"
                      onClick={sendReply}
                      disabled={!replyDraft.trim()}
                      className="shrink-0 px-5 py-2.5 rounded-full bg-primary text-white text-sm font-bold disabled:opacity-40"
                    >
                      {t('community.reply')}
                    </button>
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
                        <img
                          src={v.user.profile?.avatarUrl || fallbackAvatar(v.user.id)}
                          alt=""
                          className="size-10 rounded-full object-cover shrink-0"
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
