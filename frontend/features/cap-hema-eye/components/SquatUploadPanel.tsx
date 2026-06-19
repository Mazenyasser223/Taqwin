import { useRef, useState } from 'react';
import { useI18n } from '../../../lib/i18n/useI18n';
import type { SquatLevel } from '../lib/squatThresholds';
import { useSquatAnalysisLoop } from '../hooks/useSquatAnalysisLoop';
import { SquatFeedbackList, SquatStatsBar } from './SquatStatsBar';

interface Props {
  level: SquatLevel;
  active: boolean;
}

export function SquatUploadPanel({ level, active }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const analysisActive = active && analyzing && !!fileUrl;
  const { stats, modelLoading, modelError } = useSquatAnalysisLoop(videoRef, canvasRef, level, analysisActive, false);

  const onFileChange = (file: File | null) => {
    setAnalyzing(false);
    setUploadError(null);
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    if (!file) {
      setFileUrl(null);
      return;
    }
    if (!file.type.startsWith('video/')) {
      setUploadError(t('capHemaEye.uploadInvalid'));
      setFileUrl(null);
      return;
    }
    setFileUrl(URL.createObjectURL(file));
  };

  const startAnalysis = () => {
    const video = videoRef.current;
    if (!video || !fileUrl) {
      setUploadError(t('capHemaEye.uploadRequired'));
      return;
    }
    setUploadError(null);
    video.currentTime = 0;
    void video.play().then(() => setAnalyzing(true));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t('capHemaEye.uploadHint')}</p>
      <div className="glass-panel rounded-2xl border border-subtle p-4 space-y-3">
        <label className="block space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-faint">{t('capHemaEye.uploadLabel')}</span>
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/x-msvideo,video/*"
            disabled={!active}
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted file:me-4 file:rounded-xl file:border-0 file:bg-primary file:px-4 file:py-2 file:text-xs file:font-black file:uppercase file:text-white"
          />
        </label>
        <button
          type="button"
          disabled={!fileUrl || !active}
          onClick={startAnalysis}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-sm">play_arrow</span>
          {t('capHemaEye.analyzeUpload')}
        </button>
        {uploadError && <p className="text-sm text-red-400">{uploadError}</p>}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-subtle bg-black aspect-video max-h-[min(70vh,720px)]">
        {fileUrl && (
          <video
            ref={videoRef}
            src={fileUrl}
            className="absolute inset-0 size-full object-contain opacity-0 pointer-events-none"
            playsInline
            muted
            loop={analyzing}
            onEnded={() => setAnalyzing(false)}
          />
        )}
        <canvas ref={canvasRef} className="relative z-10 size-full object-contain" />
        {!fileUrl && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
            {t('capHemaEye.uploadEmpty')}
          </div>
        )}
        {analysisActive && (modelLoading || modelError) && (
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
