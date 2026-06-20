import React, { useCallback, useEffect, useRef } from 'react';
import { ResponsiveBackgroundVideo } from '../../components/shared/ResponsiveBackgroundVideo';

/** Full-resolution auth intro — portrait vs landscape (no transcoding). */
const AUTH_VIDEO_PORTRAIT = '/assets/auth/signup-bg.mp4';
const AUTH_VIDEO_LANDSCAPE = '/assets/auth/signup-bg-landscape.mp4';

interface AuthVideoBackgroundProps {
  paused?: boolean;
  /** Fire once when playback reaches (duration − leadSeconds). */
  onReveal?: () => void;
  leadSeconds?: number;
}

/** Full-screen auth intro video; reveals the login card shortly before the clip ends. */
export const AuthVideoBackground: React.FC<AuthVideoBackgroundProps> = ({
  paused = false,
  onReveal,
  leadSeconds = 1,
}) => {
  const revealedRef = useRef(false);

  const fireReveal = useCallback(() => {
    if (revealedRef.current || !onReveal) return;
    revealedRef.current = true;
    onReveal();
  }, [onReveal]);

  const checkRevealTime = useCallback(
    (video: HTMLVideoElement | null) => {
      if (!video || revealedRef.current) return;

      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;

      if (duration <= leadSeconds) {
        fireReveal();
        return;
      }

      if (video.currentTime >= duration - leadSeconds) {
        fireReveal();
      }
    },
    [fireReveal, leadSeconds],
  );

  const onVideoEnded = useCallback(() => {
    fireReveal();
  }, [fireReveal]);

  useEffect(() => {
    if (paused || !onReveal) return;
    const fallbackMs = 22_000;
    const id = window.setTimeout(fireReveal, fallbackMs);
    return () => window.clearTimeout(id);
  }, [paused, onReveal, fireReveal]);

  if (paused) {
    return <div className="absolute inset-0 bg-background" aria-hidden />;
  }

  return (
    <ResponsiveBackgroundVideo
      portraitSrc={AUTH_VIDEO_PORTRAIT}
      landscapeSrc={AUTH_VIDEO_LANDSCAPE}
      onLoadedMetadata={checkRevealTime}
      onTimeUpdate={checkRevealTime}
      onEnded={onVideoEnded}
    />
  );
};
