import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';

const SQUAT_REFERENCE = '/assets/landing/cap-hema-eye/captain-hema-squat-pose-tracking.jpg';

type Props = {
  className?: string;
};

export function LandingCaptainHemaSquatPreview({ className = '' }: Props) {
  const { t } = useI18n();

  return (
    <div className={`absolute inset-0 ${className}`}>
      <img
        src={SQUAT_REFERENCE}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        loading="lazy"
        decoding="async"
        aria-hidden
      />

      <span className="absolute top-2.5 left-2.5 z-20 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#ADFF2F] border border-[#7CFC00]/40 backdrop-blur-sm">
        <span className="size-1.5 rounded-full bg-[#7CFC00] animate-pulse" />
        {t('landing.mockCapHemaEyeTracking')}
      </span>
    </div>
  );
}
