import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';

export type CompeteSelectOption = {
  value: string;
  label: string;
};

export function CompeteSelect({
  label,
  value,
  options,
  onChange,
  disabled,
  className,
}: {
  label: string;
  value: string;
  options: CompeteSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative min-w-0', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl border border-subtle bg-elevated px-3 py-2.5 text-start transition-colors',
          'hover:bg-elevated-hover focus:outline-none focus:ring-2 focus:ring-primary/40',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted leading-none mb-1">
            {label}
          </span>
          <span className="block truncate text-sm font-bold text-foreground">{selected?.label ?? '—'}</span>
        </span>
        <span
          className={cn(
            'material-symbols-outlined shrink-0 text-[20px] text-muted transition-transform',
            open && 'rotate-180',
          )}
        >
          expand_more
        </span>
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-subtle bg-surface py-1 shadow-xl custom-scrollbar"
        >
          {options.map((opt) => (
            <li key={opt.value} role="option" aria-selected={opt.value === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center px-4 py-2.5 text-start text-sm font-semibold transition-colors hover:bg-elevated',
                  opt.value === value ? 'bg-primary/10 text-primary' : 'text-foreground',
                )}
              >
                <span className="truncate">{opt.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
