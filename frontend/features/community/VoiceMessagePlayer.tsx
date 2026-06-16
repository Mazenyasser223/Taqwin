import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';

interface VoiceMessagePlayerProps {
  src: string;
  variant?: 'mine' | 'theirs';
  className?: string;
}

const WAVE_BARS = [4, 7, 5, 9, 6, 8, 4, 10, 5, 7, 6, 9, 4, 8, 5, 7, 6, 4, 8, 5];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function isValidDuration(d: number): boolean {
  return Number.isFinite(d) && d > 0 && d !== Infinity;
}

/** WebM blobs from MediaRecorder often report Infinity until probed. */
function readDuration(audio: HTMLAudioElement): number {
  return isValidDuration(audio.duration) ? audio.duration : 0;
}

function probeWebMDuration(audio: HTMLAudioElement, onDuration: (d: number) => void) {
  const found = readDuration(audio);
  if (found > 0) {
    onDuration(found);
    return () => {};
  }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    audio.removeEventListener('loadedmetadata', onMeta);
    audio.removeEventListener('durationchange', onMeta);
    audio.removeEventListener('timeupdate', onTimeUpdate);
    window.clearTimeout(fallbackTimer);
  };

  const onMeta = () => {
    const d = readDuration(audio);
    if (d > 0) {
      onDuration(d);
      cleanup();
    }
  };

  const onTimeUpdate = () => {
    const d = readDuration(audio);
    if (d > 0) {
      audio.currentTime = 0;
      onDuration(d);
      cleanup();
    }
  };

  audio.addEventListener('loadedmetadata', onMeta);
  audio.addEventListener('durationchange', onMeta);
  audio.addEventListener('timeupdate', onTimeUpdate);

  const savedTime = audio.currentTime;
  try {
    audio.currentTime = 1e101;
  } catch {
    /* ignore — will resolve on play */
  }

  const fallbackTimer = window.setTimeout(() => {
    const d = readDuration(audio);
    if (d > 0) {
      onDuration(d);
    } else {
      audio.currentTime = savedTime;
    }
    cleanup();
  }, 500);

  return cleanup;
}

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
  src,
  variant = 'theirs',
  className = '',
}) => {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [estimatedDuration, setEstimatedDuration] = useState(0);
  const [loadError, setLoadError] = useState(false);

  const isMine = variant === 'mine';
  const effectiveDuration = duration > 0 ? duration : estimatedDuration;
  const progress =
    effectiveDuration > 0 ? Math.min(1, current / effectiveDuration) : playing ? 0.15 : 0;
  const displayTime =
    playing || current > 0
      ? formatTime(current)
      : effectiveDuration > 0
        ? formatTime(effectiveDuration)
        : '0:00';

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;

    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    setLoadError(false);
    setEstimatedDuration(0);

    audio.pause();
    audio.load();

    const applyDuration = (d: number) => {
      if (d > 0) setDuration(d);
    };

    const onTimeUpdate = () => {
      setCurrent(audio.currentTime);
      if (audio.currentTime > 0) {
        setEstimatedDuration((prev) => Math.max(prev, audio.currentTime));
      }
      const d = readDuration(audio);
      if (d > 0) setDuration((prev) => (prev > 0 ? prev : d));
    };

    const onEnded = () => {
      const finalDuration = readDuration(audio) || audio.currentTime;
      if (finalDuration > 0) {
        setDuration(finalDuration);
        setEstimatedDuration(finalDuration);
      }
      setPlaying(false);
      setCurrent(0);
      audio.currentTime = 0;
    };

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => setLoadError(true);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);

    const stopProbe = probeWebMDuration(audio, applyDuration);

    return () => {
      audio.pause();
      stopProbe();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
    };
  }, [src]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || loadError) return;
    if (playing) {
      audio.pause();
    } else {
      void audio.play().catch(() => setLoadError(true));
    }
  }, [playing, loadError]);

  const seek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const audio = audioRef.current;
      const dur = effectiveDuration;
      if (!audio || dur <= 0) {
        toggle();
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      audio.currentTime = pct * dur;
    },
    [effectiveDuration, toggle],
  );

  const btnClass = isMine
    ? 'bg-white/25 hover:bg-white/35 text-white ring-1 ring-white/30'
    : 'bg-primary/20 hover:bg-primary/30 text-primary ring-1 ring-primary/25';
  const barActive = isMine ? 'bg-white' : 'bg-primary';
  const barInactive = isMine ? 'bg-white/30' : 'bg-primary/20';
  const timeClass = isMine ? 'text-white/90' : 'text-foreground/80';

  return (
    <div className={`flex items-center gap-2.5 min-w-[11rem] max-w-[14rem] py-0.5 ${className}`}>
      <audio ref={audioRef} src={src} preload="auto" playsInline />

      <button
        type="button"
        onClick={toggle}
        disabled={loadError}
        aria-label={playing ? t('community.pauseVoice') : t('community.playVoice')}
        className={`shrink-0 size-10 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 ${btnClass}`}
      >
        <span
          className="material-symbols-outlined text-[26px] leading-none"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {loadError ? 'error' : playing ? 'pause' : 'play_arrow'}
        </span>
      </button>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        <div
          className="flex-1 flex items-end gap-[2px] h-7 cursor-pointer select-none"
          onClick={seek}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={effectiveDuration || 100}
          aria-valuenow={current}
          aria-label={t('community.voiceProgress')}
        >
          {WAVE_BARS.map((h, i) => {
            const barProgress = (i + 0.5) / WAVE_BARS.length;
            const filled = barProgress <= progress;
            return (
              <span
                key={i}
                className={`w-[3px] rounded-full origin-bottom transition-colors duration-150 ${
                  filled ? barActive : barInactive
                } ${playing ? 'voice-bar-animate' : ''}`}
                style={{
                  height: `${h * 2 + 6}px`,
                  animationDelay: playing ? `${(i % 5) * 90}ms` : undefined,
                }}
              />
            );
          })}
        </div>

        <span className={`text-[11px] font-bold tabular-nums shrink-0 min-w-[2.25rem] text-right ${timeClass}`}>
          {displayTime}
        </span>
      </div>
    </div>
  );
};
