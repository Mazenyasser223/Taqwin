import React, { useCallback, useEffect, useRef } from 'react';
import { Logo } from '../../components/shared/Logo';

const LANDING_VIDEO_PORTRAIT = '/assets/landing/landing-bg.mp4';
const LANDING_VIDEO_LANDSCAPE = '/assets/landing/landing-bg-landscape.mp4';

const VIDEO_CLASS =
  'absolute inset-x-0 top-0 h-[115%] w-full object-cover object-[center_12%] sm:object-[center_18%] md:object-[center_22%]';

function isLandscapeViewport(): boolean {
  const type = window.screen?.orientation?.type;
  if (type) return type.startsWith('landscape');
  if (window.matchMedia('(orientation: landscape)').matches) return true;
  return window.innerWidth > window.innerHeight;
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

    active.muted = true;
    void active.play().catch(() => {
      /* Autoplay blocked — parent fallback timeout reveals hero. */
    });
  }, [paused, fireEnded]);

  useEffect(() => {
    syncPlayback();

    const onViewportChange = () => syncPlayback();
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
        className={`${VIDEO_CLASS} portrait:block landscape:hidden`}
        src={LANDING_VIDEO_PORTRAIT}
        autoPlay
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-hidden
        onEnded={fireEnded}
      />
      <video
        ref={landscapeRef}
        className={`${VIDEO_CLASS} hidden object-center landscape:block`}
        src={LANDING_VIDEO_LANDSCAPE}
        autoPlay
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-hidden
        onEnded={fireEnded}
      />
    </>
  );
};
