import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../lib/i18n/useI18n';
import type { PushupLevel } from '../lib/pushupThresholds';
import { usePushupAnalysisLoop } from '../hooks/usePushupAnalysisLoop';
import { SquatFeedbackList, SquatStatsBar } from './SquatStatsBar';

interface Props {
  level: PushupLevel;
  active: boolean;
}

type CameraFacing = 'user' | 'environment';

export function PushupLivePanel({ level, active }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [facingMode, setFacingMode] = useState<CameraFacing>('user');
  const [mirrorFrame, setMirrorFrame] = useState(true);

  const analysisActive = active && cameraReady;
  const { stats, modelLoading, modelError, resetCounters } = usePushupAnalysisLoop(
    videoRef,
    canvasRef,
    level,
    analysisActive,
    mirrorFrame,
  );

  const toggleCamera = useCallback(() => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = viewportRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      // Browser may block fullscreen without a direct user gesture.
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === viewportRef.current);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async (facing: CameraFacing, previousDeviceId?: string) => {
    const videoBase = { width: { ideal: 1280 }, height: { ideal: 720 } };

    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { ...videoBase, facingMode: facing },
        audio: false,
      });
    } catch {
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
        (device) => device.kind === 'videoinput' && device.deviceId,
      );
      if (devices.length < 2) throw new Error('camera unavailable');

      const currentIdx = devices.findIndex((device) => device.deviceId === previousDeviceId);
      const nextDevice = devices[(currentIdx + 1) % devices.length];
      return navigator.mediaDevices.getUserMedia({
        video: { ...videoBase, deviceId: { exact: nextDevice.deviceId } },
        audio: false,
      });
    }
  }, []);

  useEffect(() => {
    if (!active) {
      stopCamera();
      return;
    }

    let cancelled = false;
    const previousDeviceId = streamRef.current?.getVideoTracks()[0]?.getSettings().deviceId;
    setCameraError(null);
    setCameraReady(false);
    stopCamera();

    void startCamera(facingMode, previousDeviceId)
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const facing = stream.getVideoTracks()[0]?.getSettings().facingMode;
        setMirrorFrame(facing !== 'environment');
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          void video.play().then(() => setCameraReady(true));
        }
      })
      .catch(() => {
        if (!cancelled) setCameraError(t('capHemaEye.cameraError'));
      });

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [active, facingMode, startCamera, stopCamera, t]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t('capHemaEye.pushupLiveHint')}</p>
      {cameraError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {cameraError}
        </div>
      )}
      <details className="glass-panel rounded-xl border border-subtle px-4 py-3 text-sm text-muted">
        <summary className="cursor-pointer font-bold text-foreground">{t('capHemaEye.cameraHelpTitle')}</summary>
        <p className="mt-2 whitespace-pre-line">{t('capHemaEye.cameraHelpBody')}</p>
      </details>
      <div
        ref={viewportRef}
        className="relative overflow-hidden rounded-2xl border border-subtle bg-black aspect-video max-h-[min(70vh,720px)] [&:fullscreen]:flex [&:fullscreen]:aspect-auto [&:fullscreen]:max-h-none [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:rounded-none [&:fullscreen]:border-0"
      >
        <video ref={videoRef} className="absolute inset-0 size-full object-cover opacity-0" playsInline muted autoPlay />
        <canvas ref={canvasRef} className="relative z-10 size-full object-contain" />
        <div className="absolute top-3 right-3 z-30 flex gap-2">
          <button
            type="button"
            onClick={toggleCamera}
            aria-label={facingMode === 'user' ? t('capHemaEye.useBackCamera') : t('capHemaEye.useFrontCamera')}
            title={facingMode === 'user' ? t('capHemaEye.useBackCamera') : t('capHemaEye.useFrontCamera')}
            className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-black/50 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
          >
            <span className="material-symbols-outlined text-xl">flip_camera_ios</span>
          </button>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            aria-label={isFullscreen ? t('capHemaEye.exitFullscreen') : t('capHemaEye.fullscreen')}
            title={isFullscreen ? t('capHemaEye.exitFullscreen') : t('capHemaEye.fullscreen')}
            className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-black/50 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
          >
            <span className="material-symbols-outlined text-xl">
              {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
            </span>
          </button>
        </div>
        {(modelLoading || modelError || !cameraReady) && !cameraError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 text-sm font-bold text-white">
            {modelError ?? (cameraReady ? t('capHemaEye.loadingModel') : t('capHemaEye.startingCamera'))}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SquatStatsBar stats={stats} />
        <button
          type="button"
          onClick={resetCounters}
          className="inline-flex items-center gap-1.5 rounded-xl border border-subtle bg-elevated px-4 py-2 text-xs font-black uppercase tracking-wider text-muted hover:text-foreground transition-colors"
        >
          <span className="material-symbols-outlined text-sm">restart_alt</span>
          {t('capHemaEye.resetCounters')}
        </button>
      </div>
      <SquatFeedbackList stats={stats} />
    </div>
  );
}
