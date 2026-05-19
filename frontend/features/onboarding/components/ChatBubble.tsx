import React from 'react';
import { motion } from 'framer-motion';
import { CoachAvatar } from './CoachAvatar';

interface ChatBubbleProps {
  role: 'coach' | 'user';
  children: React.ReactNode;
  imageUrl?: string;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ role, children, imageUrl }) => {
  const isCoach = role === 'coach';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isCoach ? 'justify-start' : 'justify-end'} mb-3`}
    >
      {isCoach && (
        <div className="flex-shrink-0 size-9 rounded-full bg-background border border-primary/40 flex items-center justify-center p-1 me-2 mt-0.5 shadow-sm shadow-primary/10 overflow-hidden">
          <CoachAvatar />
        </div>
      )}
      <motion.div
        className={`max-w-[min(100%,20rem)] sm:max-w-md rounded-2xl text-sm leading-relaxed shadow-sm overflow-hidden ${
          isCoach
            ? 'bg-surface border border-subtle text-foreground rounded-tl-sm'
            : 'bg-gradient-to-br from-primary to-primary/85 text-white rounded-tr-sm shadow-primary/20'
        }`}
      >
        {isCoach && imageUrl && (
          <img
            src={imageUrl}
            alt=""
            className="w-full max-h-44 object-cover object-top"
            loading="lazy"
          />
        )}
        <motion.div className={`px-4 py-3 whitespace-pre-line ${imageUrl && isCoach ? 'pt-2.5' : ''}`}>
          {children}
        </motion.div>
      </motion.div>
    </motion.div>
  );
};
