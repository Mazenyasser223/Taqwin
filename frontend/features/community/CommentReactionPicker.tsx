import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CommunityComment } from '../../types';
import { REACTIONS, reactionSymbol, type ReactionEmoji } from './reactions';

interface CommentReactionPickerProps {
  comment: CommunityComment;
  onReact: (emoji: ReactionEmoji) => void;
  compact?: boolean;
}

export const CommentReactionPicker: React.FC<CommentReactionPickerProps> = ({
  comment,
  onReact,
  compact = true,
}) => {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const total = comment.likesCount ?? 0;

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
        onClick={() => onReact(comment.myReaction ? comment.myReaction : 'like')}
        className={`flex items-center gap-1 text-xs transition-colors ${
          comment.myReaction ? 'text-primary' : 'text-faint hover:text-primary'
        }`}
      >
        <span className="text-sm leading-none">
          {comment.myReaction ? reactionSymbol(comment.myReaction) : '👍'}
        </span>
        {total > 0 && <span className="font-semibold tabular-nums">{total}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            className={`absolute bottom-full z-30 flex gap-0.5 p-1.5 rounded-full bg-surface border border-border shadow-xl ${
              compact ? 'left-0' : 'left-1/2 -translate-x-1/2'
            }`}
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
                className={`size-8 rounded-full text-base hover:scale-110 transition-transform ${
                  comment.myReaction === r.id ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-elevated'
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
