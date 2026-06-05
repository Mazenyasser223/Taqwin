import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';

interface UploadProgressBarProps {
  percent: number;
  className?: string;
}

export const UploadProgressBar: React.FC<UploadProgressBarProps> = ({ percent, className = '' }) => {
  const { t } = useI18n();
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      <div className="flex justify-between text-xs font-semibold text-primary tabular-nums">
        <span>{t('community.uploading')}</span>
        <span>{clamped}%</span>
      </div>
      <div className="h-2 rounded-full bg-black/30 overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-[width] duration-150 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
};
