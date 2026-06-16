import React, { useCallback, useEffect, useRef, useState } from 'react';

/** Full-resolution auth intro — portrait vs landscape (no transcoding). */
const AUTH_VIDEO_PORTRAIT = '/assets/auth/signup-bg.mp4';
const AUTH_VIDEO_LANDSCAPE = '/assets/auth/signup-bg-landscape.mp4';

function isLandscapeViewport(): boolean {
  if (window.matchMedia('(orientation: landscape)').matches) return true;
  return window.innerWidth > window.innerHeight;
}

function playWhenReady(video: HTMLVideoElement): void {
  video.muted = true;
  const attempt = () => {
    void video.play().catch(() => {
      /* Autoplay blocked — parent fallback reveals card. */
    });
  };
  if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    attempt();
  } else {
    video.addEventListener('canplay', attempt, { once: true });
  }
}

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
  const portraitRef = useRef<HTMLVideoElement>(null);
  const landscapeRef = useRef<HTMLVideoElement>(null);
  const revealedRef = useRef(false);
  const endedRef = useRef(false);
  const [isLandscape, setIsLandscape] = useState(() =>
    typeof window !== 'undefined' ? isLandscapeViewport() : false,
  );

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
    endedRef.current = true;
    fireReveal();
  }, [fireReveal]);

  const syncPlayback = useCallback(() => {
    const portrait = portraitRef.current;
    const landscape = landscapeRef.current;
    if (!portrait || !landscape) return;

    if (paused) {
      portrait.pause();
      landscape.pause();
      fireReveal();
      return;
    }

    if (endedRef.current || revealedRef.current) return;

    const showLandscape = isLandscapeViewport();
    const active = showLandscape ? landscape : portrait;
    const inactive = showLandscape ? portrait : landscape;

    inactive.pause();
    inactive.loop = false;
    inactive.currentTime = 0;

    active.loop = false;
    active.currentTime = 0;
    playWhenReady(active);
  }, [paused, fireReveal]);

  useEffect(() => {
    const updateOrientation = () => setIsLandscape(isLandscapeViewport());
    updateOrientation();

    const onViewportChange = () => {
      updateOrientation();
      if (!endedRef.current) syncPlayback();
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

  useEffect(() => {
    if (paused || !onReveal) return;
    const fallbackMs = 22_000;
    const id = window.setTimeout(fireReveal, fallbackMs);
    return () => window.clearTimeout(id);
  }, [paused, onReveal, fireReveal]);

  if (paused) {
    return <div className="absolute inset-0 bg-background" aria-hidden />;
  }

  const videoClass =
    'absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-300';

  return (
    <>
      <video
        ref={portraitRef}
        className={`${videoClass} ${isLandscape ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
        src={AUTH_VIDEO_PORTRAIT}
        autoPlay
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-hidden={isLandscape}
        onLoadedMetadata={() => checkRevealTime(portraitRef.current)}
        onTimeUpdate={() => checkRevealTime(portraitRef.current)}
        onEnded={onVideoEnded}
      />
      <video
        ref={landscapeRef}
        className={`${videoClass} ${isLandscape ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        src={AUTH_VIDEO_LANDSCAPE}
        autoPlay
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-hidden={!isLandscape}
        onLoadedMetadata={() => checkRevealTime(landscapeRef.current)}
        onTimeUpdate={() => checkRevealTime(landscapeRef.current)}
        onEnded={onVideoEnded}
      />
    </>
  );
};
