import React, { useCallback, useRef } from 'react';
import { Logo } from '../../components/shared/Logo';
import { ResponsiveBackgroundVideo } from '../../components/shared/ResponsiveBackgroundVideo';

/** Full-resolution sources — copied as-is from repo root (no transcoding). */
const LANDING_VIDEO_PORTRAIT = '/assets/landing/landing-bg.mp4';
const LANDING_VIDEO_LANDSCAPE = '/assets/landing/landing-bg-landscape.mp4';

interface LandingVideoBackgroundProps {
  paused?: boolean;
  onEnded?: () => void;
}

export const LandingVideoBackground: React.FC<LandingVideoBackgroundProps> = ({
  paused = false,
  onEnded,
}) => {
  const endedRef = useRef(false);

  const fireEnded = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    onEnded?.();
  }, [onEnded]);

  if (paused) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background">
        <Logo size="xl" />
      </div>
    );
  }

  return (
    <ResponsiveBackgroundVideo
      portraitSrc={LANDING_VIDEO_PORTRAIT}
      landscapeSrc={LANDING_VIDEO_LANDSCAPE}
      onEnded={fireEnded}
    />
  );
};
