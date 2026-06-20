import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../lib/i18n/useI18n';
import { GYM_AMENITY_CATALOG } from '../../lib/gymAmenities';
import type { TranslationKey } from '../../lib/i18n/translations';
import type { Gym } from '../../types';
import {
  buildGymFilterOptions,
  DEFAULT_GYM_FILTERS,
  type GymFilterState,
  type GymMembershipFilter,
  type GymOccupancyFilter,
  type GymSortOption,
} from './gymFilters';

const PANEL_WIDTH = 320;

type PanelPos = { top: number; left: number };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: GymFilterState;
  onChange: (next: GymFilterState) => void;
  activeCount: number;
  hasLocation: boolean;
  gyms: Gym[];
  resultCount: number;
  hasMembershipOption: boolean;
};

function clampPanelLeft(buttonRect: DOMRect, panelWidth: number): number {
  const margin = 12;
  const preferred = buttonRect.right - panelWidth;
  return Math.max(margin, Math.min(preferred, window.innerWidth - panelWidth - margin));
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-faint mb-2">{children}</p>
  );
}

function Chip({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border transition-colors ${
        disabled
          ? 'cursor-not-allowed border-subtle bg-elevated/50 text-faint opacity-50'
          : active
            ? 'border-primary bg-primary/15 text-primary'
            : 'border-subtle bg-elevated text-muted hover:border-primary/30 hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

export const GymFilterMenu: React.FC<Props> = ({
  open,
  onOpenChange,
  filters,
  onChange,
  activeCount,
  hasLocation,
  gyms,
  resultCount,
  hasMembershipOption,
}) => {
  const { t } = useI18n();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<PanelPos | null>(null);

  const options = useMemo(() => buildGymFilterOptions(gyms), [gyms]);

  const updatePosition = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 24);
    setPanelPos({
      top: rect.bottom + 8,
      left: clampPanelLeft(rect, width),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onOpenChange(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onOpenChange]);

  const toggleArea = (city: string) => {
    const next = filters.areas.includes(city)
      ? filters.areas.filter((a) => a !== city)
      : [...filters.areas, city];
    onChange({ ...filters, areas: next });
  };

  const setOccupancy = (occupancy: GymOccupancyFilter) =>
    onChange({ ...filters, occupancy: occupancy === 'all' ? 'all' : occupancy });

  const setMembership = (membership: GymMembershipFilter) => onChange({ ...filters, membership });

  const setSort = (sort: GymSortOption) => onChange({ ...filters, sort });

  const toggleAmenity = (id: (typeof options.amenities)[number]['id']) => {
    const next = filters.amenities.includes(id)
      ? filters.amenities.filter((a) => a !== id)
      : [...filters.amenities, id];
    onChange({ ...filters, amenities: next });
  };

  const occupancyOptions: { id: GymOccupancyFilter; labelKey: TranslationKey; count: number }[] = [
    { id: 'all', labelKey: 'gyms.filterOccupancyAll', count: options.occupancy.all },
    { id: 'quiet', labelKey: 'gyms.statusQuiet', count: options.occupancy.quiet },
    { id: 'active', labelKey: 'gyms.statusActive', count: options.occupancy.active },
    { id: 'busy', labelKey: 'gyms.statusBusy', count: options.occupancy.busy },
  ];

  const membershipOptions: { id: GymMembershipFilter; labelKey: TranslationKey }[] = [
    { id: 'all', labelKey: 'gyms.filterMembershipAll' },
    { id: 'mine', labelKey: 'gyms.filterMembershipMine' },
  ];

  const sortOptions: { id: GymSortOption; labelKey: TranslationKey; disabled?: boolean }[] = [
    { id: 'default', labelKey: 'gyms.sortDefault' },
    { id: 'nearest', labelKey: 'gyms.sortNearest', disabled: !hasLocation },
    { id: 'name', labelKey: 'gyms.sortName' },
    { id: 'leastBusy', labelKey: 'gyms.sortLeastBusy' },
  ];

  const portal =
    open &&
    panelPos &&
    typeof document !== 'undefined' &&
    createPortal(
      <>
        <div className="fixed inset-0 z-[140] bg-black/25 sm:bg-black/15" aria-hidden onClick={() => onOpenChange(false)} />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('gyms.filters')}
          className="fixed z-[150] rounded-2xl border border-subtle bg-background shadow-2xl shadow-black/60 flex flex-col max-h-[min(70vh,520px)] overflow-hidden"
          style={{
            top: panelPos.top,
            left: panelPos.left,
            width: `min(${PANEL_WIDTH}px, calc(100vw - 1.5rem))`,
            minWidth: '17.5rem',
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3">
            <div>
              <p className="text-sm font-black text-foreground">{t('gyms.filters')}</p>
              <p className="text-[10px] font-bold text-muted mt-0.5">
                {t('gyms.filterPreview', { count: String(resultCount) })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChange(DEFAULT_GYM_FILTERS)}
              className="text-[10px] font-black uppercase tracking-wider text-primary hover:underline shrink-0"
            >
              {t('gyms.clearFilters')}
            </button>
          </div>

          <div className="overflow-y-auto custom-scrollbar px-4 py-4 space-y-5">
            {options.areas.length > 0 && (
              <div>
                <SectionLabel>{t('gyms.filterCity')}</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {options.areas.map(({ city, count, sampleLocation }) => (
                    <Chip
                      key={city}
                      active={filters.areas.includes(city)}
                      onClick={() => toggleArea(city)}
                    >
                      {city} ({count})
                      <span className="sr-only">{sampleLocation}</span>
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            <div>
              <SectionLabel>{t('gyms.filterOccupancy')}</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {occupancyOptions.map((opt) => (
                  <Chip
                    key={opt.id}
                    active={filters.occupancy === opt.id}
                    disabled={opt.id !== 'all' && opt.count === 0}
                    onClick={() => {
                      if (opt.id !== 'all' && opt.count === 0) return;
                      setOccupancy(opt.id);
                    }}
                  >
                    {t(opt.labelKey)} ({opt.count})
                  </Chip>
                ))}
              </div>
            </div>

            {hasMembershipOption && (
              <div>
                <SectionLabel>{t('gyms.filterMembership')}</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {membershipOptions.map((opt) => (
                    <Chip
                      key={opt.id}
                      active={filters.membership === opt.id}
                      onClick={() => setMembership(opt.id)}
                    >
                      {t(opt.labelKey)}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {options.amenities.length > 0 && (
              <div>
                <SectionLabel>{t('gyms.filterAmenities')}</SectionLabel>
                <p className="text-[10px] text-muted mb-2">{t('gyms.filterAmenitiesHint')}</p>
                <div className="flex flex-wrap gap-2">
                  {options.amenities.map(({ id, count }) => {
                    const entry = GYM_AMENITY_CATALOG.find((a) => a.id === id);
                    return (
                      <Chip
                        key={id}
                        active={filters.amenities.includes(id)}
                        onClick={() => toggleAmenity(id)}
                      >
                        {entry ? `${entry.icon} ${t(entry.labelKey)}` : id} ({count})
                      </Chip>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <SectionLabel>{t('gyms.filterSort')}</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {sortOptions.map((opt) => (
                  <Chip
                    key={opt.id}
                    active={filters.sort === opt.id}
                    disabled={Boolean(opt.disabled)}
                    onClick={() => !opt.disabled && setSort(opt.id)}
                  >
                    {t(opt.labelKey)}
                  </Chip>
                ))}
              </div>
              {!hasLocation && (
                <p className="mt-2 text-[10px] text-muted">{t('gyms.sortNearestHint')}</p>
              )}
            </div>
          </div>

          <div className="border-t border-subtle px-4 py-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full rounded-xl bg-primary py-2.5 text-xs font-black uppercase tracking-wider text-primary-foreground"
            >
              {t('gyms.applyFilters')}
            </button>
          </div>
        </div>
      </>,
      document.body,
    );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t('gyms.filters')}
        className={`relative shrink-0 flex items-center justify-center size-[3.25rem] rounded-2xl border font-black transition-all ${
          open || activeCount > 0
            ? 'bg-primary/15 border-primary text-primary'
            : 'bg-elevated border-subtle text-faint hover:border-primary/40 hover:text-foreground'
        }`}
      >
        <span className="material-symbols-outlined text-2xl">tune</span>
        {activeCount > 0 && (
          <span className="absolute -top-1 -end-1 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>
      {portal}
    </>
  );
};
