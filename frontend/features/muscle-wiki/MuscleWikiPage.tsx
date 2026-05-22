import { useState } from 'react'
import { useI18n } from '../../lib/i18n/useI18n'
import { CaptainHemaCanvas } from './components/CaptainHemaCanvas'
import { ExercisePanel } from './components/ExercisePanel'
import type { MuscleZone } from './types'

export function MuscleWikiPage() {
  const { t } = useI18n()
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleZone | null>(null)
  const [hoveredMuscle, setHoveredMuscle] = useState<MuscleZone | null>(null)

  return (
    <div className="page-shell w-full min-w-0 bg-[#070b12]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.08),_transparent_50%),radial-gradient(ellipse_at_bottom_right,_rgba(244,63,94,0.06),_transparent_45%)]"
      />
      <div className="relative mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 p-0 md:gap-8 md:p-0 lg:flex-row lg:gap-10">
        <header className="lg:hidden">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/80">
            {t('muscleWiki.brand')}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">{t('muscleWiki.title')}</h1>
        </header>

        <section className="flex min-h-0 flex-1 flex-col lg:min-h-[calc(100dvh-4rem)] lg:w-[58%]">
          <div className="mb-4 hidden shrink-0 lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/80">
              {t('muscleWiki.interactive3d')}
            </p>
            <h1 className="mt-1 text-3xl font-bold text-white">{t('muscleWiki.title')}</h1>
            <p className="mt-2 max-w-md text-sm text-slate-400">{t('muscleWiki.subtitle')}</p>
          </div>
          <div className="flex h-[420px] w-full flex-1 lg:h-auto lg:min-h-[420px]">
            <CaptainHemaCanvas
              selectedMuscle={selectedMuscle}
              onMuscleSelect={setSelectedMuscle}
              onMuscleHover={setHoveredMuscle}
            />
          </div>
        </section>

        <section className="flex min-h-0 flex-1 flex-col lg:min-h-[calc(100dvh-4rem)] lg:w-[42%]">
          <ExercisePanel selectedMuscle={selectedMuscle} hoveredMuscle={hoveredMuscle} />
        </section>
      </div>
    </div>
  )
}
