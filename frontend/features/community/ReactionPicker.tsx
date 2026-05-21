import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CommunityPost } from '../../types';
import { REACTIONS, reactionSymbol, type ReactionEmoji } from './reactions';

interface ReactionPickerProps {
  post: CommunityPost;
  onReact: (emoji: ReactionEmoji) => void;
}

export const ReactionPicker: React.FC<ReactionPickerProps> = ({ post, onReact }) => {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);

  const total = post.likesCount ?? 0;
  const topReactions = REACTIONS.filter((r) => (post.reactions?.[r.id] ?? 0) > 0).slice(0, 3);

  const handleEnter = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setOpen(true);
  };

  const handleLeave = () => {
    timer.current = window.setTimeout(() => setOpen(false), 200);
  };

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        type="button"
        onClick={() => onReact(post.myReaction ? post.myReaction : 'like')}
        className={`flex items-center gap-1.5 text-sm transition-colors ${
          post.myReaction ? 'text-primary' : 'text-muted hover:text-primary'
        }`}
      >
        <span className="text-lg leading-none">
          {post.myReaction ? reactionSymbol(post.myReaction) : '👍'}
        </span>
        <span className="font-semibold tabular-nums">{total}</span>
        {topReactions.length > 0 && !post.myReaction && (
          <span className="flex -space-x-1 ml-0.5">
            {topReactions.map((r) => (
              <span key={r.id} className="text-xs">
                {r.symbol}
              </span>
            ))}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            className="absolute bottom-full left-0 mb-2 z-20 flex gap-1 p-2 rounded-full bg-surface border border-border shadow-xl"
          >
            {REACTIONS.map((r) => (
              <button
                key={r.id}
                type="button"
                title={r.label}
                onClick={() => {
                  onReact(r.id);
                  setOpen(false);
                }}
                className={`size-10 rounded-full text-xl hover:scale-125 transition-transform ${
                  post.myReaction === r.id ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-elevated'
                }`}
              >
                {r.symbol}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
