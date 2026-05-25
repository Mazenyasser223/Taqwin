import React from 'react';
import { cn } from '../../lib/cn';
import { feedCard, feedPanel } from './communityFeedStyles';

function Bone({ className }: { className?: string }) {
  return <div className={cn('skeleton-bone rounded-xl', className)} aria-hidden />;
}

export const CommunityFeedSkeleton: React.FC = () => (
  <div className="space-y-5 sm:space-y-6" aria-busy aria-label="Loading feed">
    <div className={`${feedPanel} p-4 space-y-3`}>
      <div className="flex gap-3">
        <Bone className="size-10 rounded-full shrink-0" />
        <Bone className="h-20 flex-1 rounded-2xl" />
      </div>
      <Bone className="h-9 w-28 rounded-xl" />
    </div>
    <div className={`${feedPanel} p-3 flex gap-3 overflow-hidden`}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Bone key={i} className="size-16 shrink-0 rounded-full" />
      ))}
    </div>
    <div className="flex gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Bone key={i} className="h-9 flex-1 min-w-[4rem] rounded-xl" />
      ))}
    </div>
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className={`${feedCard} p-4 space-y-3`}>
        <div className="flex gap-3">
          <Bone className="size-12 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Bone className="h-4 w-32" />
            <Bone className="h-3 w-24" />
          </div>
        </div>
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-4/5" />
        <Bone className="h-48 w-full rounded-2xl" />
        <Bone className="h-8 w-48 rounded-xl" />
      </div>
    ))}
  </div>
);
