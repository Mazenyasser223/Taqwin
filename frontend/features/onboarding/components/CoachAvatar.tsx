import React, { useId } from 'react';

/** Compact Taqwin logo mark for chat coach avatar (unique gradient ids per instance). */
export const CoachAvatar: React.FC<{ className?: string }> = ({ className = '' }) => {
  const uid = useId().replace(/:/g, '');
  const tealId = `coachTeal-${uid}`;
  const orangeId = `coachOrange-${uid}`;

  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`w-full h-full ${className}`}
      aria-hidden
    >
      <defs>
        <linearGradient id={tealId} x1="200" y1="50" x2="200" y2="350" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#158b8d" />
          <stop offset="100%" stopColor="#0a314d" />
        </linearGradient>
        <linearGradient id={orangeId} x1="250" y1="200" x2="250" y2="380" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f37021" />
          <stop offset="100%" stopColor="#fbaf40" />
        </linearGradient>
      </defs>
      <path d="M50 40 H350 V100 H240 V360 H160 V100 H50 Z" fill={`url(#${tealId})`} />
      <path
        d="M130 310 C180 300 250 220 310 100 L330 115 L340 85 L305 90 L320 105 C260 225 190 305 130 310 Z"
        fill="white"
        fillOpacity="0.9"
      />
      <rect x="200" y="280" width="12" height="60" rx="4" fill={`url(#${orangeId})`} />
      <rect x="230" y="240" width="12" height="100" rx="4" fill={`url(#${orangeId})`} />
      <rect x="260" y="200" width="12" height="140" rx="4" fill={`url(#${orangeId})`} />
    </svg>
  );
};
