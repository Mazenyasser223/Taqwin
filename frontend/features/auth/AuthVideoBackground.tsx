import React, { useEffect, useRef } from 'react';

const AUTH_VIDEO_SRC = '/taqwin-login.mp4';

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const revealedRef = useRef(false);

  const fireReveal = () => {
    if (revealedRef.current || !onReveal) return;
    revealedRef.current = true;
    onReveal();
  };

  const checkRevealTime = () => {
    const video = videoRef.current;
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
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (paused) {
      video.pause();
      return;
    }

    revealedRef.current = false;
    video.muted = true;
    video.loop = false;
    video.currentTime = 0;

    const play = () => {
      void video.play().catch(() => {
        fireReveal();
      });
    };
    play();

    const onVisibility = () => {
      if (document.hidden) video.pause();
      else if (!paused && !revealedRef.current) play();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [paused, onReveal, leadSeconds]);

  useEffect(() => {
    if (paused || !onReveal) return;
    const fallbackMs = 12_000;
    const id = window.setTimeout(fireReveal, fallbackMs);
    return () => window.clearTimeout(id);
  }, [paused, onReveal]);

  if (paused) {
    return <div className="absolute inset-0 bg-background" aria-hidden />;
  }

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 h-full w-full object-cover object-center"
      src={AUTH_VIDEO_SRC}
      autoPlay
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
      aria-hidden
      onLoadedMetadata={checkRevealTime}
      onTimeUpdate={checkRevealTime}
      onEnded={fireReveal}
    />
  );
};
