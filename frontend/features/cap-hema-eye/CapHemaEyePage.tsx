import { useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import type { SquatLevel } from './lib/squatThresholds';
import type { PushupLevel } from './lib/pushupThresholds';
import { SquatDemoPanel } from './components/SquatDemoPanel';
import { SquatLivePanel } from './components/SquatLivePanel';
import { SquatUploadPanel } from './components/SquatUploadPanel';
import { PushupLivePanel } from './components/PushupLivePanel';

type Exercise = 'squat' | 'pushup';
type SquatTab = 'demo' | 'live' | 'upload';

const EXERCISES: { id: Exercise; icon: string; labelKey: 'capHemaEye.exerciseSquat' | 'capHemaEye.exercisePushup' }[] = [
  { id: 'squat', icon: 'fitness_center', labelKey: 'capHemaEye.exerciseSquat' },
  { id: 'pushup', icon: 'sports_gymnastics', labelKey: 'capHemaEye.exercisePushup' },
];

const SQUAT_TABS: { id: SquatTab; icon: string; labelKey: 'capHemaEye.tabDemo' | 'capHemaEye.tabLive' | 'capHemaEye.tabUpload' }[] = [
  { id: 'demo', icon: 'smart_display', labelKey: 'capHemaEye.tabDemo' },
  { id: 'live', icon: 'videocam', labelKey: 'capHemaEye.tabLive' },
  { id: 'upload', icon: 'upload_file', labelKey: 'capHemaEye.tabUpload' },
];

export function CapHemaEyePage() {
  const { t } = useI18n();
  const [exercise, setExercise] = useState<Exercise>('squat');
  const [squatTab, setSquatTab] = useState<SquatTab>('live');
  const [level, setLevel] = useState<SquatLevel | PushupLevel>('beginner');

  const subtitleKey =
    exercise === 'pushup' ? 'capHemaEye.subtitlePushup' : 'capHemaEye.subtitle';

  return (
    <div className="page-shell pb-2 space-y-6">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-6">
        <div>
          <div className="flex items-center gap-3 text-primary mb-2">
            <span className="material-symbols-outlined font-black">remove_red_eye</span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">{t('capHemaEye.badge')}</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">{t('capHemaEye.title')}</h1>
          <p className="text-muted mt-4 max-w-2xl font-medium">{t(subtitleKey)}</p>
        </div>

        <div className="flex flex-col items-start lg:items-end gap-3">
          <div className="inline-flex rounded-2xl border border-subtle bg-elevated p-1">
            {EXERCISES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setExercise(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors ${
                  exercise === item.id ? 'bg-primary text-white' : 'text-muted hover:text-foreground'
                }`}
              >
                <span className="material-symbols-outlined text-sm">{item.icon}</span>
                {t(item.labelKey)}
              </button>
            ))}
          </div>

          {exercise === 'squat' && (
            <div className="inline-flex rounded-2xl border border-subtle bg-elevated p-1">
              {SQUAT_TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSquatTab(item.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors ${
                    squatTab === item.id ? 'bg-primary text-white' : 'text-muted hover:text-foreground'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">{item.icon}</span>
                  {t(item.labelKey)}
                </button>
              ))}
            </div>
          )}

          <div className="inline-flex rounded-2xl border border-subtle bg-elevated p-1">
            {(['beginner', 'pro'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setLevel(mode)}
                className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors ${
                  level === mode ? 'bg-primary/15 text-primary border border-primary/30' : 'text-muted hover:text-foreground'
                }`}
              >
                {t(mode === 'beginner' ? 'capHemaEye.levelBeginner' : 'capHemaEye.levelPro')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-3xl border border-subtle p-4 sm:p-6">
        {exercise === 'squat' && squatTab === 'demo' && (
          <SquatDemoPanel level={level} active={squatTab === 'demo'} />
        )}
        {exercise === 'squat' && squatTab === 'live' && (
          <SquatLivePanel level={level} active={squatTab === 'live'} />
        )}
        {exercise === 'squat' && squatTab === 'upload' && (
          <SquatUploadPanel level={level} active={squatTab === 'upload'} />
        )}
        {exercise === 'pushup' && <PushupLivePanel level={level} active={exercise === 'pushup'} />}
      </div>
    </div>
  );
}
