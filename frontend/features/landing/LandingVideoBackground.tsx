import React, { useEffect, useRef, useState } from 'react';
import { Logo } from '../../components/shared/Logo';

const LANDING_VIDEO_PORTRAIT = '/assets/landing/landing-bg.mp4';
const LANDING_VIDEO_LANDSCAPE = '/assets/landing/landing-bg-landscape.mp4';

function landingVideoForOrientation(): string {
  if (typeof window === 'undefined') return LANDING_VIDEO_PORTRAIT;
  return window.matchMedia('(orientation: landscape)').matches
    ? LANDING_VIDEO_LANDSCAPE
    : LANDING_VIDEO_PORTRAIT;
}

interface LandingVideoBackgroundProps {
  /** When true, skip video playback (reduced motion / performance mode). */
  paused?: boolean;
  /** Fires once when the intro video finishes its first play-through. */
  onEnded?: () => void;
}

export const LandingVideoBackground: React.FC<LandingVideoBackgroundProps> = ({
  paused = false,
  onEnded,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const endedRef = useRef(false);
  const [videoSrc, setVideoSrc] = useState(landingVideoForOrientation);

  const fireEnded = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    onEnded?.();
  };

  useEffect(() => {
    const mql = window.matchMedia('(orientation: landscape)');
    const onOrientationChange = () => {
      setVideoSrc(mql.matches ? LANDING_VIDEO_LANDSCAPE : LANDING_VIDEO_PORTRAIT);
    };
    mql.addEventListener('change', onOrientationChange);
    return () => mql.removeEventListener('change', onOrientationChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (paused) {
      video.pause();
      fireEnded();
      return;
    }

    video.muted = true;
    const play = () => {
      void video.play().catch(() => {
        /* Autoplay blocked — parent fallback timeout reveals hero. */
      });
    };
    play();

    const onVisibility = () => {
      if (document.hidden) video.pause();
      else if (!paused && !endedRef.current) play();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [paused, videoSrc]);

  if (paused) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background">
        <Logo size="xl" />
      </div>
    );
  }

  return (
    <video
      key={videoSrc}
      ref={videoRef}
      className="absolute inset-x-0 top-0 h-[115%] w-full object-cover object-[center_12%] sm:object-[center_18%] md:object-[center_22%] landscape:object-center"
      src={videoSrc}
      autoPlay
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
      aria-hidden
      onEnded={fireEnded}
    />
  );
};
