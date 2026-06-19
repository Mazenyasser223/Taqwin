import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../lib/i18n/useI18n';
import type { SquatLevel } from '../lib/squatThresholds';
import { useSquatAnalysisLoop } from '../hooks/useSquatAnalysisLoop';
import { SquatFeedbackList, SquatStatsBar } from './SquatStatsBar';

interface Props {
  level: SquatLevel;
  active: boolean;
}

export function SquatLivePanel({ level, active }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const analysisActive = active && cameraReady;
  const { stats, modelLoading, modelError, resetCounters } = useSquatAnalysisLoop(
    videoRef,
    canvasRef,
    level,
    analysisActive,
    true,
  );

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  }, []);

  useEffect(() => {
    if (!active) {
      stopCamera();
      return;
    }

    let cancelled = false;
    setCameraError(null);

    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
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
  }, [active, stopCamera, t]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t('capHemaEye.liveHint')}</p>
      {cameraError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {cameraError}
        </div>
      )}
      <details className="glass-panel rounded-xl border border-subtle px-4 py-3 text-sm text-muted">
        <summary className="cursor-pointer font-bold text-foreground">{t('capHemaEye.cameraHelpTitle')}</summary>
        <p className="mt-2 whitespace-pre-line">{t('capHemaEye.cameraHelpBody')}</p>
      </details>
      <div className="relative overflow-hidden rounded-2xl border border-subtle bg-black aspect-video max-h-[min(70vh,720px)]">
        <video ref={videoRef} className="absolute inset-0 size-full object-cover opacity-0" playsInline muted autoPlay />
        <canvas ref={canvasRef} className="relative z-10 size-full object-contain" />
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
