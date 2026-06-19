import { useEffect, useRef } from 'react';
import { useI18n } from '../../../lib/i18n/useI18n';
import type { SquatLevel } from '../lib/squatThresholds';
import { useSquatAnalysisLoop } from '../hooks/useSquatAnalysisLoop';
import { SquatFeedbackList, SquatStatsBar } from './SquatStatsBar';

const SAMPLE_VIDEO = '/cap-hema-eye/output_sample.mp4';

interface Props {
  level: SquatLevel;
  active: boolean;
}

export function SquatDemoPanel({ level, active }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { stats, modelLoading, modelError } = useSquatAnalysisLoop(videoRef, canvasRef, level, active, false);

  useEffect(() => {
    if (!active || !videoRef.current) return;
    videoRef.current.currentTime = 0;
    void videoRef.current.play();
  }, [active, level]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t('capHemaEye.demoHint')}</p>
      <div className="relative overflow-hidden rounded-2xl border border-subtle bg-black aspect-video max-h-[min(70vh,720px)]">
        <video
          ref={videoRef}
          src={SAMPLE_VIDEO}
          className="absolute inset-0 size-full object-contain opacity-0 pointer-events-none"
          playsInline
          muted
          loop
          autoPlay={active}
          controls={false}
        />
        <canvas ref={canvasRef} className="relative z-10 size-full object-contain" />
        {(modelLoading || modelError) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 text-sm font-bold text-white">
            {modelError ?? t('capHemaEye.loadingModel')}
          </div>
        )}
      </div>
      <SquatStatsBar stats={stats} />
      <SquatFeedbackList stats={stats} />
    </div>
  );
}
