import { useI18n } from '../../../lib/i18n/useI18n'
import { MUSCLE_BADGE_COLORS } from '../muscleExercises'
import { ALL_MUSCLE_WIKI_REGIONS, REGION_BADGE_COLORS, muscleRegionKey } from '../muscleRegions'
import type { MuscleRegion } from '../types'

export interface MuscleZonePickerProps {
  selected?: MuscleRegion | null
  onSelect: (region: MuscleRegion) => void
  showMissingHint?: boolean
}

function badgeClassFor(region: MuscleRegion) {
  return REGION_BADGE_COLORS[region] ?? MUSCLE_BADGE_COLORS[region as keyof typeof MUSCLE_BADGE_COLORS] ?? MUSCLE_BADGE_COLORS.chest
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
        {ALL_MUSCLE_WIKI_REGIONS.map((region) => {
          const active = selected === region
          return (
            <button
              key={region}
              type="button"
              onClick={() => onSelect(region)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider ring-1 transition ${
                badgeClassFor(region)
              } ${active ? 'ring-2 ring-cyan-400' : 'opacity-90 hover:opacity-100'}`}
            >
              {t(muscleRegionKey(region))}
            </button>
          )
        })}
      </div>
    </div>
  )
}
