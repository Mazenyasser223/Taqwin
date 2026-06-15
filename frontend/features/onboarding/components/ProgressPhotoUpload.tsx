import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import progressPhotoService, {
  ProgressPhotoAnalysis,
  ProgressPhotoPose,
} from '../../../services/progressPhotoService';
import { UploadProgressBar } from '../../../components/ui/UploadProgressBar';
import { ImageLightbox } from '../../../components/ui/ImageLightbox';
import { useI18n } from '../../../lib/i18n/useI18n';

export interface ProgressPhotoUploadMeta {
  id?: string;
  analysis?: ProgressPhotoAnalysis | null;
}

interface ProgressPhotoUploadProps {
  label: string;
  pose: ProgressPhotoPose;
  value?: string | null;
  onChange: (url: string | null, meta?: ProgressPhotoUploadMeta) => void;
  compact?: boolean;
}

export const ProgressPhotoUpload: React.FC<ProgressPhotoUploadProps> = ({
  label,
  pose,
  value,
  onChange,
  compact = false,
}) => {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [analysisHint, setAnalysisHint] = useState<string | null>(null);

  const handlePick = () => {
    if (!uploading) inputRef.current?.click();
  };

  const handleFile = async (file?: File) => {
    if (!file || uploading) return;
    setUploading(true);
    setUploadPercent(15);
    setError(null);
    setAnalysisHint(null);

    const timer = window.setInterval(() => {
      setUploadPercent((p) => (p >= 90 ? p : p + 8));
    }, 400);

    const res = await progressPhotoService.analyzeAndSave(file, pose);

    window.clearInterval(timer);
    setUploading(false);
    setUploadPercent(0);

    if (res.error) {
      setError(res.error);
      return;
    }

    const photo = res.data?.progressPhoto;
    if (!photo?.photoUrl) {
      setError(t('onboarding.photos.errorSave'));
      return;
    }

    const coaching =
      photo.analysis?.coachingNotes?.trim() ||
      photo.analysis?.postureNotes?.trim() ||
      null;
    setAnalysisHint(coaching);
    onChange(photo.photoUrl, { id: photo.id, analysis: photo.analysis });
  };

  const statusLabel = uploading
    ? t('onboarding.photos.analyzing')
    : t('onboarding.photos.upload');

  return (
    <motion.div
      className={`rounded-xl sm:rounded-2xl border border-subtle bg-surface/60 h-full flex flex-col min-h-0 ${
        compact ? 'p-2 sm:p-3 space-y-2' : 'p-4 space-y-3'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        capture="environment"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
        className="hidden"
      />

      <motion.div className="flex items-center justify-between gap-2 shrink-0">
        <span className={`font-bold ${compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'}`}>{label}</span>
        {value && !uploading && (
          <button
            type="button"
            onClick={() => {
              setAnalysisHint(null);
              onChange(null);
            }}
            className="text-[11px] font-bold text-faint hover:text-red-400"
          >
            {t('onboarding.photos.remove')}
          </button>
        )}
      </motion.div>

      {value && !uploading ? (
        <div
          className={`relative flex w-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-subtle bg-elevated ${
            compact ? 'aspect-[3/4] max-h-[7.5rem] sm:max-h-36' : 'aspect-[3/4] max-h-48'
          }`}
        >
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="relative min-h-0 flex-1 w-full cursor-zoom-in"
            aria-label={t('onboarding.photos.viewFull')}
          >
            <img src={value} alt="" className="h-full w-full object-cover" />
          </button>
          <button
            type="button"
            onClick={handlePick}
            className="shrink-0 py-2 text-center text-[11px] font-bold bg-background/70 backdrop-blur-sm hover:bg-background/90"
          >
            {t('onboarding.photos.replace')}
          </button>
        </div>
      ) : (
        <motion.button
          type="button"
          onClick={handlePick}
          disabled={uploading}
          whileTap={uploading ? undefined : { scale: 0.98 }}
          className={`w-full flex-1 min-h-0 flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/35 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-colors disabled:opacity-60 ${
            compact ? 'py-4 sm:py-5' : 'py-8'
          }`}
        >
          {uploading ? (
            <span className={`material-symbols-outlined text-primary animate-spin ${compact ? 'text-2xl' : 'text-3xl'}`}>
              progress_activity
            </span>
          ) : (
            <span className={`material-symbols-outlined text-primary ${compact ? 'text-2xl' : 'text-3xl'}`}>
              add_a_photo
            </span>
          )}
          <span className={`font-bold text-primary ${compact ? 'text-xs sm:text-sm' : 'text-sm'}`}>
            {statusLabel}
          </span>
          {!compact && !uploading && (
            <span className="text-[10px] text-faint text-center px-2">{t('onboarding.photos.bodyOnlyHint')}</span>
          )}
        </motion.button>
      )}

      {uploading && <UploadProgressBar percent={uploadPercent} />}
      {error && <p className="text-xs text-red-400 shrink-0">{error}</p>}
      {!error && analysisHint && (
        <p className="text-[11px] text-muted shrink-0 line-clamp-3" title={analysisHint}>
          {analysisHint}
        </p>
      )}
      {value && (
        <ImageLightbox
          open={previewOpen}
          src={value}
          alt={label}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </motion.div>
  );
};
