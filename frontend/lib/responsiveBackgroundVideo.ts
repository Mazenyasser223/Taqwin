import { useCallback, useEffect, useState } from 'react';

export function isLandscapeViewport(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(orientation: landscape)').matches) return true;
  return window.innerWidth > window.innerHeight;
}

export function playWhenReady(video: HTMLVideoElement): void {
  video.muted = true;
  const attempt = () => {
    void video.play().catch(() => {
      /* Autoplay blocked — parent fallback timeout reveals UI. */
    });
  };
  if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    attempt();
  } else {
    video.addEventListener('canplay', attempt, { once: true });
  }
}

/** Pause intro/backdrop clips before leaving the page (e.g. Google OAuth redirect). */
export function pausePageBackgroundVideos(): void {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('video').forEach((node) => {
    (node as HTMLVideoElement).pause();
  });
}

export function useResponsiveVideoOrientation(): boolean {
  const [isLandscape, setIsLandscape] = useState(() => isLandscapeViewport());

  useEffect(() => {
    const update = () => setIsLandscape(isLandscapeViewport());

    const onViewportChange = () => update();
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange);
    window.screen?.orientation?.addEventListener('change', onViewportChange);

    return () => {
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('orientationchange', onViewportChange);
      window.screen?.orientation?.removeEventListener('change', onViewportChange);
    };
  }, []);

  return isLandscape;
}

export function useBackgroundVideoPlayback(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  paused: boolean,
  activeSrc: string,
): void {
  const play = useCallback(() => {
    const video = videoRef.current;
    if (!video || paused) return;
    video.loop = false;
    playWhenReady(video);
  }, [videoRef, paused]);

  useEffect(() => {
    if (paused) {
      videoRef.current?.pause();
      return;
    }
    play();
  }, [paused, play, videoRef, activeSrc]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        videoRef.current?.pause();
      } else if (!paused) {
        play();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [videoRef, paused, play]);
}
