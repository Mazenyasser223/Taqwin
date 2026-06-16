import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../../lib/cn';
import { TA_SELECT } from './adminShopUi';

export type AdminFilterOption = {
  value: string;
  label: string;
};

type AdminFilterSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: AdminFilterOption[];
  allLabel: string;
  className?: string;
};

export const AdminFilterSelect: React.FC<AdminFilterSelectProps> = ({
  value,
  onChange,
  options,
  allLabel,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(() => {
    if (!value) return allLabel;
    return options.find((o) => o.value === value)?.label ?? allLabel;
  }, [value, options, allLabel]);

  useEffect(() => {
    if (!open || !rootRef.current) return;

    const updatePosition = () => {
      if (!rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      const panelHeight = Math.min(320, (options.length + 1) * 44 + 16);
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropUp = spaceBelow < panelHeight && rect.top > panelHeight;

      setPanelStyle({
        position: 'fixed',
        left: rect.left,
        width: Math.max(rect.width, 220),
        top: dropUp ? rect.top - 8 : rect.bottom + 8,
        transform: dropUp ? 'translateY(-100%)' : undefined,
        zIndex: 9999,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const selectValue = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn('relative min-w-[220px]', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          TA_SELECT,
          'flex min-h-[44px] items-center justify-between gap-3 text-start',
          !value && 'text-gray-600 dark:text-gray-300'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate font-medium text-gray-900 dark:text-white">{selectedLabel}</span>
        <span className="material-symbols-outlined shrink-0 text-xl text-gray-400">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              style={panelStyle}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl ring-1 ring-black/5"
              role="listbox"
            >
              <ul className="max-h-72 overflow-y-auto py-1">
                <li>
                  <button
                    type="button"
                    onClick={() => selectValue('')}
                    className={cn(
                      'flex w-full items-center px-4 py-3 text-start text-sm font-medium text-gray-900 transition hover:bg-brand-500/8',
                      value === '' && 'bg-brand-500/10 text-brand-600'
                    )}
                  >
                    {allLabel}
                  </button>
                </li>
                {options.map((option) => (
                  <li key={option.value}>
                    <button
                      type="button"
                      onClick={() => selectValue(option.value)}
                      className={cn(
                        'flex w-full items-center px-4 py-3 text-start text-sm font-medium text-gray-900 transition hover:bg-brand-500/8',
                        value === option.value && 'bg-brand-500/10 font-semibold text-brand-600'
                      )}
                    >
                      {option.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>,
            document.body
          )
        : null}
    </div>
  );
};
