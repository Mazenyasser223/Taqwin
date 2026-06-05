import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../lib/i18n/useI18n';
import { NutritionFilterPanel } from './NutritionFilterPanel';
import type { NutritionFilterState } from './nutritionFilters';

const PANEL_WIDTH = 296;

type PanelPos = { top: number; left: number };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: NutritionFilterState;
  onChange: (next: NutritionFilterState) => void;
  activeCount: number;
};

function clampPanelLeft(buttonRect: DOMRect, panelWidth: number): number {
  const margin = 12;
  const preferred = buttonRect.right - panelWidth;
  return Math.max(margin, Math.min(preferred, window.innerWidth - panelWidth - margin));
}

export const NutritionFilterMenu: React.FC<Props> = ({
  open,
  onOpenChange,
  filters,
  onChange,
  activeCount,
}) => {
  const { t } = useI18n();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<PanelPos | null>(null);

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
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
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

  const portal =
    open &&
    panelPos &&
    typeof document !== 'undefined' &&
    createPortal(
      <>
        <div className="fixed inset-0 z-[140] bg-black/25 sm:bg-black/15" aria-hidden />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('nutrition.sortLabel')}
          className="fixed z-[150] rounded-2xl border border-subtle bg-surface shadow-2xl shadow-black/60 flex flex-col min-w-0"
          style={{
            top: panelPos.top,
            left: panelPos.left,
            width: `min(${PANEL_WIDTH}px, calc(100vw - 1.5rem))`,
            minWidth: '17.5rem',
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <NutritionFilterPanel
            filters={filters}
            onChange={onChange}
            onClose={() => onOpenChange(false)}
          />
        </div>
      </>,
      document.body
    );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t('nutrition.filters')}
        className={`relative shrink-0 flex items-center justify-center size-[3.5rem] rounded-2xl border font-black transition-all ${
          open || activeCount > 0
            ? 'bg-accent/15 border-accent text-accent'
            : 'bg-elevated border-subtle text-faint hover:border-accent/40 hover:text-foreground'
        }`}
      >
        <span className="material-symbols-outlined text-2xl">tune</span>
        {activeCount > 0 && (
          <span className="absolute -top-1 -end-1 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-accent text-white text-[10px] font-black flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>
      {portal}
    </>
  );
};
