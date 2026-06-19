import React from 'react';
import { LandingCaptainHemaSquatPreview } from './LandingCaptainHemaSquatPreview';

type Props = {
  className?: string;
};

export function LandingCapHemaEyePreview({ className = '' }: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-[#c8c8c8]/40 bg-[#e8e8e8] aspect-video shadow-inner ${className}`}
    >
      <LandingCaptainHemaSquatPreview />

      <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-white/5 pointer-events-none" />
    </div>
  );
}
