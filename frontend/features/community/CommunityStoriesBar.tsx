import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import communityService from '../../services/communityService';
import uploadService from '../../services/uploadService';
import type { StoryAuthorBundle, StoryViewer } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { displayName, fallbackAvatar } from './communityUtils';
import { useI18n } from '../../lib/i18n/useI18n';
import { StoryReactionPicker } from './StoryReactionPicker';
import type { ReactionEmoji } from './reactions';
import { reactionSymbol } from './reactions';

const STORY_DURATION_MS = 5000;

interface CommunityStoriesBarProps {
  refreshRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}

export const CommunityStoriesBar: React.FC<CommunityStoriesBarProps> = ({ refreshRef }) => {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [bundles, setBundles] = useState<StoryAuthorBundle[]>([]);
  const [viewer, setViewer] = useState<{ bundle: StoryAuthorBundle; index: number } | null>(null);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<StoryViewer[]>([]);
  const [replyDraft, setReplyDraft] = useState('');
  const [progress, setProgress] = useState(0);
  const [timerPaused, setTimerPaused] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const timerStartRef = useRef(0);
  const rafRef = useRef<number>(0);
  const barRef = useRef<HTMLDivElement>(null);
  const [framePos, setFramePos] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const computeFrameLayout = useCallback(() => {
    const pad = 12;
    const maxW = window.innerWidth - pad * 2;
    const bar = barRef.current;
    const anchorTop = bar ? bar.getBoundingClientRect().top : pad;
    const availableH = window.innerHeight - anchorTop - pad;
    let height = Math.min(availableH, maxW * (16 / 9), window.innerHeight * 0.78);
    let width = height * (9 / 16);
    if (width > maxW) {
      width = maxW;
      height = width * (16 / 9);
    }
    width = Math.min(width, 352);
    height = Math.min(height, availableH);

    let left = pad;
    if (bar) {
      const rect = bar.getBoundingClientRect();
      left = rect.left + Math.max(0, (rect.width - width) / 2);
      left = Math.min(Math.max(pad, left), window.innerWidth - width - pad);
    } else {
      left = (window.innerWidth - width) / 2;
    }

    return { top: anchorTop, left, width, height };
  }, []);

  const load = useCallback(() => {
    return communityService.getStoriesFeed().then((res) => {
      setBundles(res.data ?? []);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (refreshRef) refreshRef.current = load;
    return () => {
      if (refreshRef) refreshRef.current = null;
    };
  }, [load, refreshRef]);

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
    const update = () => setFramePos(computeFrameLayout());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [viewer, computeFrameLayout]);

  const currentStory = viewer ? viewer.bundle.stories[viewer.index] : null;
  const isOwnStory = viewer?.bundle.author.id === user?.id;
  const goNext = useCallback(() => {
    if (!viewer) return;
    const next = viewer.index + 1;
    if (next >= viewer.bundle.stories.length) {
      setViewer(null);
      load();
      return;
    }
    const story = viewer.bundle.stories[next];
    setViewer({ bundle: viewer.bundle, index: next });
    if (story) void communityService.viewStory(story.id);
  }, [viewer, load]);

  useEffect(() => {
    if (!viewer || !currentStory) return;
    setReplyDraft('');
    setViewersOpen(false);
    setProgress(0);
  }, [currentStory?.id, currentStory?.myReaction, viewer]);

  useEffect(() => {
    if (!viewer || !currentStory || viewersOpen || timerPaused) return;

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
  }, [viewer?.index, currentStory?.id, viewersOpen, timerPaused, goNext]);

  const addStory = async (file: File) => {
    setUploading(true);
    const isVideo = file.type.startsWith('video/');
    const { url, error } = await uploadService.uploadFile(file, 'stories');
    setUploading(false);
    if (error || !url) return;
    await communityService.createStory(url, isVideo ? 'video' : 'image');
    load();
  };

  const openStory = async (bundle: StoryAuthorBundle, index: number) => {
    setViewer({ bundle, index });
    const story = bundle.stories[index];
    if (story) await communityService.viewStory(story.id);
  };

  const reactToStory = async (emoji: ReactionEmoji) => {
    if (!currentStory || !viewer || isOwnStory) return;
    const same = currentStory.myReaction === emoji;
    if (same) {
      await communityService.unreactStory(currentStory.id);
    } else {
      await communityService.reactStory(currentStory.id, emoji);
    }
    const nextReaction = same ? null : emoji;
    setViewer({
      ...viewer,
      bundle: {
        ...viewer.bundle,
        stories: viewer.bundle.stories.map((s) =>
          s.id === currentStory.id ? { ...s, myReaction: nextReaction } : s,
        ),
      },
    });
  };

  const sendReply = async () => {
    if (!currentStory || !replyDraft.trim()) return;
    await communityService.replyToStory(currentStory.id, replyDraft.trim());
    setReplyDraft('');
    load();
  };

  const showViewers = async () => {
    if (!currentStory) return;
    const res = await communityService.getStoryViewers(currentStory.id);
    setViewers(res.data ?? []);
    setViewersOpen(true);
  };

  return (
    <>
      <div ref={barRef} className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="shrink-0 flex flex-col items-center gap-1"
        >
          <div className="size-16 rounded-full border-2 border-dashed border-primary flex items-center justify-center bg-primary/10">
            <span className="material-symbols-outlined text-primary">{uploading ? 'hourglass_empty' : 'add'}</span>
          </div>
          <span className="text-[10px] font-bold text-muted">{t('community.addStory')}</span>
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
        {bundles.map((b) => (
          <button
            key={b.author.id}
            type="button"
            onClick={() => openStory(b, 0)}
            className="shrink-0 flex flex-col items-center gap-1"
          >
            <div
              className={`size-16 rounded-full p-0.5 ${
                b.hasUnseen ? 'bg-gradient-to-tr from-primary via-amber-400 to-pink-500' : 'border-2 border-subtle'
              }`}
            >
              <img
                src={b.author.profile?.avatarUrl || fallbackAvatar(b.author.id)}
                alt=""
                className="size-full rounded-full object-cover border-2 border-background"
              />
            </div>
            <span className="text-[10px] font-bold text-muted max-w-[4rem] truncate">
              {b.author.id === user?.id ? t('community.yourStory') : displayName(b.author)}
            </span>
          </button>
        ))}
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {viewer && currentStory && framePos && (
              <>
                <motion.button
                  type="button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  aria-label={t('common.close')}
                  className="fixed inset-0 z-[199] cursor-default bg-transparent border-0 p-0"
                  onClick={() => setViewer(null)}
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
                    src={currentStory.mediaUrl}
                    autoPlay
                    playsInline
                    muted
                    loop
                    className="max-w-full max-h-full w-full h-full object-contain"
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
                          width:
                            i < viewer.index ? '100%' : i === viewer.index ? `${progress * 100}%` : '0%',
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 pointer-events-auto">
                  <Link
                    to={`/community/profile/${viewer.bundle.author.id}`}
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
                  <button
                    type="button"
                    onClick={() => setViewer(null)}
                    className="ml-auto text-white p-1 shrink-0"
                  >
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
                    <StoryReactionPicker
                      myReaction={currentStory.myReaction}
                      onReact={reactToStory}
                    />
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
                          to={`/community/profile/${v.user.id}`}
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
        )}
    </>
  );
};
