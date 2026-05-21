import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { REACTIONS, reactionSymbol, type ReactionEmoji } from './reactions';

interface StoryReactionPickerProps {
  myReaction?: ReactionEmoji | string | null;
  onReact: (emoji: ReactionEmoji) => void;
}

export const StoryReactionPicker: React.FC<StoryReactionPickerProps> = ({ myReaction, onReact }) => {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const active = REACTIONS.some((r) => r.id === myReaction);

  const handleEnter = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setOpen(true);
  };

  const handleLeave = () => {
    timer.current = window.setTimeout(() => setOpen(false), 200);
  };

  return (
    <div
      className="relative shrink-0"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        type="button"
        onClick={() => onReact((myReaction as ReactionEmoji) || 'like')}
        className={`size-11 rounded-full flex items-center justify-center text-xl border transition-colors ${
          active
            ? 'bg-primary/25 border-primary/50'
            : 'bg-white/15 border-white/25 hover:bg-white/25'
        }`}
        aria-label="React"
      >
        {active && myReaction ? reactionSymbol(myReaction) : '👍'}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="absolute bottom-full left-0 mb-2 z-30 flex gap-0.5 p-1.5 rounded-full bg-surface/95 border border-white/20 shadow-xl backdrop-blur-md"
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
                className={`size-9 rounded-full text-lg hover:scale-110 transition-transform ${
                  myReaction === r.id ? 'bg-primary/25 ring-2 ring-primary' : 'hover:bg-white/10'
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
