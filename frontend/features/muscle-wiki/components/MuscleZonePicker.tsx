import { useI18n } from '../../../lib/i18n/useI18n'
import { MUSCLE_BADGE_COLORS, MUSCLE_ZONES, muscleZoneKey } from '../muscleExercises'
import type { MuscleZone } from '../types'

export interface MuscleZonePickerProps {
  selected?: MuscleZone | null
  onSelect: (zone: MuscleZone) => void
  showMissingHint?: boolean
}

export function MuscleZonePicker({ selected, onSelect, showMissingHint = false }: MuscleZonePickerProps) {
  const { t } = useI18n()

  return (
    <div className="flex h-full min-h-[320px] flex-col justify-center gap-6 p-6 md:p-8">
      {showMissingHint && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
          <p className="font-semibold text-amber-200">{t('muscleWiki.modelMissing')}</p>
          <p className="mt-1 text-xs text-amber-100/70">{t('muscleWiki.modelMissingHint')}</p>
        </div>
      )}
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/80">
          {t('muscleWiki.pickMuscle')}
        </p>
        <p className="mt-2 text-sm text-slate-400">{t('muscleWiki.pickMuscleSub')}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {MUSCLE_ZONES.map((zone) => {
          const active = selected === zone
          return (
            <button
              key={zone}
              type="button"
              onClick={() => onSelect(zone)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider ring-1 transition ${
                MUSCLE_BADGE_COLORS[zone]
              } ${active ? 'ring-2 ring-cyan-400' : 'opacity-90 hover:opacity-100'}`}
            >
              {t(muscleZoneKey(zone))}
            </button>
          )
        })}
      </div>
    </div>
  )
}
