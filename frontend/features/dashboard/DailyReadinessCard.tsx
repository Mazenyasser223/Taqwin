import React, { useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import adaptationService from '../../services/adaptationService';
import { emitDashboardRefresh } from './wellnessWidgets';

type Props = {
  onLogged?: () => void;
};

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
      <span>{label}</span>
      <input
        type="range"
        min={1}
        max={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <span className="text-[10px] text-faint">{value}/5</span>
    </label>
  );
}

export const DailyReadinessCard: React.FC<Props> = ({ onLogged }) => {
  const { t } = useI18n();
  const [sleepQuality, setSleepQuality] = useState(3);
  const [soreness, setSoreness] = useState(2);
  const [rpe, setRpe] = useState(3);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const handleSave = async () => {
    setBusy(true);
    try {
      await adaptationService.submitReadiness({ sleepQuality, soreness, rpe });
      setDone(true);
      emitDashboardRefresh();
      onLogged?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-subtle bg-elevated p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-black text-foreground">{t('dashboard.dailyReadiness')}</h3>
        {done ? (
          <span className="text-[10px] font-bold uppercase tracking-wide text-teal-500">
            {t('dashboard.readinessSaved')}
          </span>
        ) : null}
      </div>
      <div className="grid gap-3">
        <SliderRow label={t('dashboard.readinessSleep')} value={sleepQuality} onChange={setSleepQuality} />
        <SliderRow label={t('dashboard.readinessSoreness')} value={soreness} onChange={setSoreness} />
        <SliderRow label={t('dashboard.readinessRpe')} value={rpe} onChange={setRpe} />
      </div>
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={busy}
        className="mt-4 w-full rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
      >
        {busy ? t('ai.thinking') : t('dashboard.saveReadiness')}
      </button>
    </div>
  );
};
