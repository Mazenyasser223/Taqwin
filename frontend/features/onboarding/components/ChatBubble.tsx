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
        <div className="flex-shrink-0 size-10 rounded-full bg-background border border-primary/40 flex items-center justify-center p-1 me-2.5 mt-0.5 shadow-sm shadow-primary/10 overflow-hidden">
          <CoachAvatar />
        </div>
      )}
      <motion.div
        className={`max-w-[min(100%,22rem)] sm:max-w-lg rounded-3xl leading-relaxed shadow-sm overflow-hidden font-[Cairo,'Space_Grotesk',sans-serif] ${
          isCoach
            ? 'bg-surface border border-subtle text-foreground rounded-tl-md text-base sm:text-lg font-semibold'
            : 'bg-gradient-to-br from-primary to-primary/85 text-white rounded-tr-md shadow-primary/20 text-sm sm:text-base font-bold'
        }`}
      >
        {isCoach && imageUrl && (
          <img
            src={imageUrl}
            alt=""
            className="w-full max-h-36 object-cover object-top"
            loading="lazy"
          />
        )}
        <div className={`px-4 py-3.5 sm:px-5 sm:py-4 whitespace-pre-line ${imageUrl && isCoach ? 'pt-2.5' : ''}`}>
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
};
