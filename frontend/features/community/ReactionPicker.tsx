import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CommunityPost } from '../../types';
import { useI18n } from '../../lib/i18n/useI18n';
import {
  REACTIONS,
  reactionSymbol,
  reactionDef,
  reactionColor,
  type ReactionEmoji,
} from './reactions';

interface ReactionPickerProps {
  post: CommunityPost;
  onReact: (emoji: ReactionEmoji) => void;
}

export const ReactionPicker: React.FC<ReactionPickerProps> = ({ post, onReact }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const hoverTimer = useRef<number | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressOpened = useRef(false);
  const skipClickRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const active = post.myReaction ?? null;
  const activeDef = reactionDef(active);

  const clearHoverTimer = () => {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleEnter = () => {
    clearHoverTimer();
    setOpen(true);
  };

  const handleLeave = () => {
    hoverTimer.current = window.setTimeout(() => setOpen(false), 280);
  };

  const handleQuickReact = () => {
    if (longPressOpened.current) {
      longPressOpened.current = false;
      return;
    }
    onReact(active ?? 'like');
  };

  const handleClick = () => {
    if (skipClickRef.current) return;
    handleQuickReact();
  };

  const handleTouchStart = () => {
    longPressOpened.current = false;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressOpened.current = true;
      setOpen(true);
    }, 450);
  };

  const handleTouchEnd = () => {
    clearLongPress();
    if (longPressOpened.current) {
      skipClickRef.current = true;
      window.setTimeout(() => {
        skipClickRef.current = false;
      }, 400);
      return;
    }
    skipClickRef.current = true;
    handleQuickReact();
    window.setTimeout(() => {
      skipClickRef.current = false;
    }, 400);
  };

  const pickReaction = (emoji: ReactionEmoji) => {
    onReact(emoji);
    setOpen(false);
  };

  const label = activeDef
    ? t(`community.reaction.${activeDef.id}` as 'community.reaction.like')
    : t('community.like');

  return (
    <div
      ref={rootRef}
      className="relative flex-1 min-w-0"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        type="button"
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={clearLongPress}
        onTouchCancel={clearLongPress}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors hover:bg-white/[0.06] active:bg-white/[0.08] group"
        style={active ? { color: reactionColor(active) } : undefined}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {active ? (
          <span className="text-[22px] leading-none select-none">{reactionSymbol(active)}</span>
        ) : (
          <span
            className="material-symbols-outlined text-[22px] text-muted group-hover:text-[#1877F2] transition-colors"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 500" }}
          >
            thumb_up
          </span>
        )}
        <span className={active ? '' : 'text-muted group-hover:text-[#1877F2] transition-colors'}>{label}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 520, damping: 28 }}
            className="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 z-30 flex items-end gap-1 px-2.5 py-2 rounded-full bg-surface border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
          >
            {REACTIONS.map((r, i) => (
              <motion.button
                key={r.id}
                type="button"
                title={t(`community.reaction.${r.id}` as 'community.reaction.like')}
                initial={{ opacity: 0, y: 8, scale: 0.6 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: i * 0.04, type: 'spring', stiffness: 480, damping: 22 }}
                whileHover={{ scale: 1.35, y: -6 }}
                whileTap={{ scale: 1.15 }}
                onClick={() => pickReaction(r.id)}
                className={`size-11 sm:size-12 flex items-center justify-center rounded-full text-[26px] sm:text-[28px] leading-none select-none ${
                  active === r.id ? 'ring-2 ring-offset-2 ring-offset-surface' : ''
                }`}
                style={active === r.id ? ({ ['--tw-ring-color' as string]: r.color } as React.CSSProperties) : undefined}
              >
                {r.symbol}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
