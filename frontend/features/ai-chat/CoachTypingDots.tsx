import React from 'react';
import { motion } from 'framer-motion';
import { useMotionPrefs } from '../../lib/motion';

interface CoachTypingDotsProps {
  size?: 'sm' | 'md';
}

/** Animated typing indicator while coach is streaming. */
export const CoachTypingDots: React.FC<CoachTypingDotsProps> = ({ size = 'md' }) => {
  const { shouldSimplify } = useMotionPrefs();
  const dotClass = size === 'sm' ? 'size-1.5' : 'size-2';
  const gapClass = size === 'sm' ? 'gap-1.5' : 'gap-3';

  return (
    <div className={`flex items-center ${gapClass}`} role="status" aria-label="Coach is typing">
      {[0, 0.2, 0.4].map((delay) => (
        <motion.div
          key={delay}
          animate={
            !shouldSimplify
              ? size === 'sm'
                ? { opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] }
                : { y: [0, -6, 0] }
              : { opacity: [0.4, 1, 0.4] }
          }
          transition={{ duration: size === 'sm' ? 1.5 : 1, repeat: Infinity, delay, ease: 'easeInOut' }}
          className={`${dotClass} rounded-full bg-primary`}
        />
      ))}
    </div>
  );
};
