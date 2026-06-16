import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { EQUIPMENT_GROUPS, type BrowseSelection, type EquipmentGroupId } from './exerciseCategoryGroups';
import {
  EXERCISE_MUSCLE_BROWSE_SECTIONS,
  exerciseMuscleBrowseKey,
  exerciseMuscleImageId,
  type ExerciseMuscleBrowseZone,
} from './exerciseMuscleBrowse';
import { PageSkeleton } from '../../components/ui/PageSkeleton';
import { ExerciseCardBackground } from './ExerciseCardBackground';

type Props = {
  muscleCounts: Record<string, number> | null;
  equipmentGroupCounts: Record<string, number> | null;
  loading?: boolean;
  onSelect: (selection: BrowseSelection) => void;
};

function BrowseTile({
  categoryId,
  label,
  count,
  icon,
  browseLabel,
  onClick,
}: {
  categoryId: string;
  label: string;
  count?: number;
  icon?: string;
  browseLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-subtle/60 w-full text-start shadow-md hover:shadow-xl hover:border-primary/40 hover:scale-[1.02] transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 aspect-[4/3] min-h-[100px] sm:min-h-[120px]"
    >
      <ExerciseCardBackground categoryId={categoryId} />
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/25 group-hover:from-black/95 transition-colors"
        aria-hidden
      />
      <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl pointer-events-none group-hover:ring-white/20" />

      {icon ? (
        <span className="absolute top-3 end-3 material-symbols-outlined text-white/40 text-3xl drop-shadow-md group-hover:text-white/55 transition-colors">
          {icon}
        </span>
      ) : null}

      <div className="relative z-10 flex h-full flex-col justify-end p-3 sm:p-4">
        <span className="block font-black text-white leading-snug line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] text-sm sm:text-base">
          {label}
        </span>
        {count != null ? (
          <span className="mt-1 block text-[10px] font-bold uppercase tracking-widest text-white/70">
            {count}
          </span>
        ) : null}
        <span className="mt-1 block text-[10px] font-bold uppercase tracking-widest text-white/70 opacity-0 group-hover:opacity-100 transition-opacity">
          {browseLabel}
        </span>
      </div>
    </button>
  );
}

export const ExerciseBrowseGrid: React.FC<Props> = ({
  muscleCounts,
  equipmentGroupCounts,
  loading,
  onSelect,
}) => {
  const { t } = useI18n();

  if (loading && !muscleCounts && !equipmentGroupCounts) {
    return <PageSkeleton variant="grid" className="mt-6 px-0" />;
  }

  return (
    <div className="mt-6 space-y-8">
      <div className="space-y-6">
        <h2 className="text-lg sm:text-xl font-black text-foreground">{t('exercises.browseByMuscle')}</h2>
        {EXERCISE_MUSCLE_BROWSE_SECTIONS.map((section) => (
          <section key={section.id} className="space-y-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-muted">{t(section.titleKey)}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {section.zones.map((zone) => (
                <BrowseTile
                  key={zone}
                  categoryId={exerciseMuscleImageId(zone)}
                  label={t(exerciseMuscleBrowseKey(zone))}
                  count={muscleCounts?.[zone]}
                  browseLabel={t('exercises.browseCategory')}
                  onClick={() => onSelect({ kind: 'muscle', id: zone })}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-black text-foreground">{t('exercises.browseByEquipment')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4">
          {EQUIPMENT_GROUPS.map((group) => (
            <BrowseTile
              key={group.id}
              categoryId={group.id}
              label={t(group.translationKey)}
              count={equipmentGroupCounts?.[group.id]}
              icon={group.icon}
              browseLabel={t('exercises.browseCategory')}
              onClick={() => onSelect({ kind: 'equipment', id: group.id as EquipmentGroupId })}
            />
          ))}
          {(equipmentGroupCounts?.other ?? 0) > 0 ? (
            <BrowseTile
              categoryId="other"
              label={t('exercises.group.other')}
              count={equipmentGroupCounts?.other}
              icon="more_horiz"
              browseLabel={t('exercises.browseCategory')}
              onClick={() => onSelect({ kind: 'equipment', id: 'other' })}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
};
