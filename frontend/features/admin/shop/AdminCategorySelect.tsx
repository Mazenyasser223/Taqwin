import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AdminCategory } from '../../../services/adminShopService';
import { cn } from '../../../lib/cn';
import { TA_SELECT } from './adminShopUi';

export function getCategoryDisplayName(cat: AdminCategory, language: string): string {
  return language === 'ar' && cat.nameAr?.trim() ? cat.nameAr.trim() : cat.nameEn;
}

type CategoryRow = {
  cat: AdminCategory;
  depth: number;
  breadcrumb: string;
};

function flattenCategoryTree(
  categories: AdminCategory[],
  language: string,
  depth = 0,
  breadcrumb = ''
): CategoryRow[] {
  const rows: CategoryRow[] = [];
  for (const cat of categories) {
    const name = getCategoryDisplayName(cat, language);
    const nextBreadcrumb = breadcrumb ? `${breadcrumb} › ${name}` : name;
    rows.push({ cat, depth, breadcrumb: nextBreadcrumb });
    if (cat.children?.length) {
      rows.push(...flattenCategoryTree(cat.children, language, depth + 1, nextBreadcrumb));
    }
  }
  return rows;
}

function collectDescendantIds(cat: AdminCategory): Set<string> {
  const ids = new Set<string>([cat.id]);
  for (const child of cat.children ?? []) {
    for (const id of collectDescendantIds(child)) ids.add(id);
  }
  return ids;
}

type AdminCategorySelectProps = {
  categories: AdminCategory[];
  value: string;
  onChange: (value: string) => void;
  language: string;
  emptyLabel: string;
  searchPlaceholder: string;
  excludeCategory?: AdminCategory | null;
  className?: string;
};

export const AdminCategorySelect: React.FC<AdminCategorySelectProps> = ({
  categories,
  value,
  onChange,
  language,
  emptyLabel,
  searchPlaceholder,
  excludeCategory,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const excludedIds = useMemo(() => {
    if (!excludeCategory) return new Set<string>();
    return collectDescendantIds(excludeCategory);
  }, [excludeCategory]);

  const rows = useMemo(
    () => flattenCategoryTree(categories, language).filter((row) => !excludedIds.has(row.cat.id)),
    [categories, language, excludedIds]
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const name = getCategoryDisplayName(row.cat, language).toLowerCase();
      const en = row.cat.nameEn.toLowerCase();
      const ar = row.cat.nameAr?.toLowerCase() ?? '';
      return (
        name.includes(q) ||
        en.includes(q) ||
        ar.includes(q) ||
        row.breadcrumb.toLowerCase().includes(q)
      );
    });
  }, [rows, query, language]);

  const selectedRow = rows.find((row) => row.cat.id === value);

  useEffect(() => {
    if (!open || !rootRef.current) return;

    const updatePosition = () => {
      if (!rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      const panelHeight = 320;
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropUp = spaceBelow < panelHeight && rect.top > panelHeight;

      setPanelStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
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
  }, [open, query, filteredRows.length]);

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
    setQuery('');
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          TA_SELECT,
          'flex min-h-[44px] items-center justify-between gap-3 text-start'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={cn('min-w-0 flex-1 truncate', !selectedRow && 'text-gray-500 dark:text-gray-400')}>
          {selectedRow ? (
            <>
              <span className="font-semibold text-gray-900 dark:text-white">
                {getCategoryDisplayName(selectedRow.cat, language)}
              </span>
              {selectedRow.depth > 0 ? (
                <span className="mt-0.5 block truncate text-[11px] text-gray-500 dark:text-gray-400">
                  {selectedRow.breadcrumb}
                </span>
              ) : null}
            </>
          ) : (
            emptyLabel
          )}
        </span>
        <span className="material-symbols-outlined shrink-0 text-xl text-gray-400">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              style={panelStyle}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="border-b border-gray-100 p-2 dark:border-gray-800">
                <div className="relative">
                  <span className="material-symbols-outlined pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-base text-gray-400">
                    search
                  </span>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 ps-10 pe-3 text-sm text-gray-900 outline-none transition focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-white/[0.04] dark:text-white"
                    autoFocus
                  />
                </div>
              </div>

              <ul className="max-h-64 overflow-y-auto py-1" role="listbox">
                <li>
                  <button
                    type="button"
                    onClick={() => selectValue('')}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2.5 text-start text-sm transition hover:bg-brand-500/8',
                      value === '' && 'bg-brand-500/10 font-semibold text-brand-600 dark:text-brand-400'
                    )}
                  >
                    <span className="material-symbols-outlined text-base text-gray-400">block</span>
                    {emptyLabel}
                  </button>
                </li>

                {filteredRows.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">—</li>
                ) : (
                  filteredRows.map((row) => {
                    const name = getCategoryDisplayName(row.cat, language);
                    const isSelected = value === row.cat.id;
                    const isGroupRoot = row.depth === 0 && Boolean(row.cat.children?.length);

                    return (
                      <li key={row.cat.id}>
                        <button
                          type="button"
                          onClick={() => selectValue(row.cat.id)}
                          style={{ paddingInlineStart: `${12 + row.depth * 16}px` }}
                          className={cn(
                            'flex w-full flex-col gap-0.5 py-2.5 pe-3 text-start text-sm transition hover:bg-brand-500/8',
                            isSelected && 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                          )}
                        >
                          <span
                            className={cn(
                              'truncate',
                              isGroupRoot
                                ? 'text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400'
                                : 'font-medium text-gray-900 dark:text-white',
                              isSelected && !isGroupRoot && 'font-semibold'
                            )}
                          >
                            {isGroupRoot ? name : row.depth > 0 ? `↳ ${name}` : name}
                          </span>
                          {row.depth > 0 ? (
                            <span className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                              {row.breadcrumb}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>,
            document.body
          )
        : null}
    </div>
  );
};
