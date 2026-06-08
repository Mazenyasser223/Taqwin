import React from 'react';

/** Lightweight skeleton while comments load. */
export const CommentsSkeleton: React.FC = () => (
  <div className="p-4 sm:p-5 space-y-4 animate-pulse">
    {[0, 1, 2].map((i) => (
      <div key={i} className="flex gap-2">
        <div className="size-8 rounded-full bg-white/10 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 rounded bg-white/10" />
          <div className="h-3 w-full max-w-[280px] rounded bg-white/8" />
        </div>
      </div>
    ))}
  </div>
);
