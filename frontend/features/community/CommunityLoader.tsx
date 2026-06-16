import React from 'react';

interface CommunityLoaderProps {
  icon?: string;
  className?: string;
}

/** Consistent community loading indicator — animated icon, no text. */
export const CommunityLoader: React.FC<CommunityLoaderProps> = ({
  icon = 'dynamic_feed',
  className = 'py-10 sm:py-16',
}) => (
  <div className={`flex items-center justify-center ${className}`}>
    <span className="material-symbols-outlined text-4xl text-primary/60 animate-pulse">{icon}</span>
  </div>
);
