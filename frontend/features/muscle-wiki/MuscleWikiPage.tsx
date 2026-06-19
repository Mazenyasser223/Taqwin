import { useState } from 'react'
import { useI18n } from '../../lib/i18n/useI18n'
import { CaptainHemaCanvas } from './components/CaptainHemaCanvas'
import { CaptainHemaFirstVisitReveal } from './components/CaptainHemaFirstVisitReveal'
import { ExercisePanel } from './components/ExercisePanel'
import { useMuscleExerciseCounts } from './useMuscleExerciseCounts'
import type { MuscleRegion } from './types'

export function MuscleWikiPage() {
  const { t } = useI18n()
  const muscleCounts = useMuscleExerciseCounts()
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleRegion | null>(null)
  const [hoveredMuscle, setHoveredMuscle] = useState<MuscleRegion | null>(null)

  return (
    <div className="page-shell muscle-wiki-page w-full min-w-0 flex min-h-0 flex-1 flex-col bg-[#070b12]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.08),_transparent_50%),radial-gradient(ellipse_at_bottom_right,_rgba(244,63,94,0.06),_transparent_45%)]"
      />
      <div className="relative mx-auto flex w-full min-w-0 max-w-7xl flex-1 min-h-0 flex-col gap-4 sm:gap-5 lg:flex-row lg:items-stretch lg:gap-5 xl:gap-7">
        <header className="shrink-0 lg:hidden">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/80">
            {t('muscleWiki.brand')}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">{t('muscleWiki.title')}</h1>
        </header>

        <section className="muscle-wiki-canvas-section flex min-h-0 flex-1 flex-col lg:min-w-0 lg:flex-1">
          <div className="muscle-wiki-desktop-header mb-3 hidden shrink-0 lg:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400/80 xl:text-xs">
              {t('muscleWiki.interactive3d')}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white xl:text-3xl">{t('muscleWiki.title')}</h1>
            <p className="mt-1.5 max-w-md text-xs text-slate-400 xl:mt-2 xl:text-sm">{t('muscleWiki.subtitle')}</p>
          </div>
          <div className="muscle-wiki-canvas-wrap flex w-full flex-1 min-h-[min(420px,52dvh)] lg:min-h-0">
            <CaptainHemaFirstVisitReveal className="flex w-full flex-1 min-h-0">
              <CaptainHemaCanvas
                selectedMuscle={selectedMuscle}
                onMuscleSelect={setSelectedMuscle}
                onMuscleHover={setHoveredMuscle}
                muscleCounts={muscleCounts}
              />
            </CaptainHemaFirstVisitReveal>
          </div>
        </section>

        <section className="muscle-wiki-panel-section flex min-h-[280px] flex-1 flex-col lg:min-h-0 lg:min-w-0 lg:max-w-md lg:flex-none xl:max-w-lg xl:flex-[0.95]">
          <ExercisePanel selectedMuscle={selectedMuscle} hoveredMuscle={hoveredMuscle} muscleCounts={muscleCounts} />
        </section>
      </div>
    </div>
  )
}
