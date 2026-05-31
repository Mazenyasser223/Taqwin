import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Logo } from '../../components/shared/Logo';

const LANDING_VIDEO_PORTRAIT = '/assets/landing/landing-bg.mp4';
const LANDING_VIDEO_LANDSCAPE = '/assets/landing/landing-bg-landscape.mp4';

const VIDEO_CLASS =
  'absolute inset-x-0 top-0 h-[115%] w-full object-cover object-[center_12%] sm:object-[center_18%] md:object-[center_22%]';

function isLandscapeViewport(): boolean {
  if (window.matchMedia('(orientation: landscape)').matches) return true;
  return window.innerWidth > window.innerHeight;
}

function playWhenReady(video: HTMLVideoElement): void {
  video.muted = true;
  const attempt = () => {
    void video.play().catch(() => {
      /* Autoplay blocked — parent fallback timeout reveals hero. */
    });
  };
  if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    attempt();
  } else {
    video.addEventListener('canplay', attempt, { once: true });
  }
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
  const portraitRef = useRef<HTMLVideoElement>(null);
  const landscapeRef = useRef<HTMLVideoElement>(null);
  const endedRef = useRef(false);
  const [isLandscape, setIsLandscape] = useState(() =>
    typeof window !== 'undefined' ? isLandscapeViewport() : false,
  );

  const fireEnded = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    onEnded?.();
  }, [onEnded]);

  const syncPlayback = useCallback(() => {
    const portrait = portraitRef.current;
    const landscape = landscapeRef.current;
    if (!portrait || !landscape) return;

    if (paused) {
      portrait.pause();
      landscape.pause();
      fireEnded();
      return;
    }

    const showLandscape = isLandscapeViewport();
    const active = showLandscape ? landscape : portrait;
    const inactive = showLandscape ? portrait : landscape;

    inactive.pause();
    inactive.currentTime = 0;

    playWhenReady(active);
  }, [paused, fireEnded]);

  useEffect(() => {
    const updateOrientation = () => setIsLandscape(isLandscapeViewport());
    updateOrientation();

    const onViewportChange = () => {
      updateOrientation();
      syncPlayback();
    };

    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange);
    window.screen?.orientation?.addEventListener('change', onViewportChange);

    const onVisibility = () => {
      if (document.hidden) {
        portraitRef.current?.pause();
        landscapeRef.current?.pause();
      } else if (!paused && !endedRef.current) {
        syncPlayback();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('orientationchange', onViewportChange);
      window.screen?.orientation?.removeEventListener('change', onViewportChange);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [paused, syncPlayback]);

  useEffect(() => {
    syncPlayback();
  }, [isLandscape, syncPlayback]);

  if (paused) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background">
        <Logo size="xl" />
      </div>
    );
  }

  return (
    <>
      <video
        ref={portraitRef}
        className={`${VIDEO_CLASS} transition-opacity duration-150 ${
          isLandscape ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
        src={LANDING_VIDEO_PORTRAIT}
        autoPlay
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-hidden={isLandscape}
        onEnded={fireEnded}
      />
      <video
        ref={landscapeRef}
        className={`${VIDEO_CLASS} object-center transition-opacity duration-150 ${
          isLandscape ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        src={LANDING_VIDEO_LANDSCAPE}
        autoPlay
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-hidden={!isLandscape}
        onEnded={fireEnded}
      />
    </>
  );
};
