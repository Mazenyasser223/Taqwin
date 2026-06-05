import React from 'react';

/** Compact Taqwin logo mark for chat coach avatar. */
export const CoachAvatar: React.FC<{ className?: string }> = ({ className = '' }) => (
  <img
    src="/logo.png"
    alt=""
    aria-hidden
    className={`w-full h-full object-contain ${className}`}
    draggable={false}
  />
);
