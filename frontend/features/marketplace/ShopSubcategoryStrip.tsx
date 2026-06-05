import React, { useRef } from 'react';
import type { ShopCategory, ShopCategoryChild } from '../../types';

interface ShopSubcategoryStripProps {
  root: ShopCategory;
  subcategories: ShopCategoryChild[];
  activeSlug: string;
  allLabel: string;
  label: (cat: { nameEn: string; nameAr?: string | null }) => string;
  onSelect: (slug: string) => void;
}

export const ShopSubcategoryStrip: React.FC<ShopSubcategoryStripProps> = ({
  root,
  subcategories,
  activeSlug,
  allLabel,
  label,
  onSelect,
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: -1 | 1) => {
    scrollerRef.current?.scrollBy({ left: dir * 220, behavior: 'smooth' });
  };

  const tiles: { slug: string; name: string; imageUrl?: string | null }[] = [
    { slug: root.slug, name: allLabel, imageUrl: root.previewImageUrl },
    ...subcategories.map((c) => ({
      slug: c.slug,
      name: label(c),
      imageUrl: c.previewImageUrl,
    })),
  ];

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        aria-label="Scroll subcategories left"
        onClick={() => scroll(-1)}
        className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-subtle bg-elevated/95 p-1.5 shadow-md backdrop-blur sm:flex"
      >
        <span className="material-symbols-outlined text-lg">chevron_left</span>
      </button>
      <button
        type="button"
        aria-label="Scroll subcategories right"
        onClick={() => scroll(1)}
        className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-subtle bg-elevated/95 p-1.5 shadow-md backdrop-blur sm:flex"
      >
        <span className="material-symbols-outlined text-lg">chevron_right</span>
      </button>

      <div
        ref={scrollerRef}
        className="flex gap-4 overflow-x-auto pb-2 px-1 -mx-1 no-scrollbar snap-x snap-mandatory"
      >
        {tiles.map((tile) => {
          const selected = activeSlug === tile.slug;
          return (
            <button
              key={tile.slug}
              type="button"
              onClick={() => onSelect(tile.slug)}
              className="flex w-[88px] shrink-0 snap-start flex-col items-center gap-2 sm:w-[100px]"
            >
              <div
                className={`flex h-[88px] w-full items-center justify-center overflow-hidden rounded-lg transition ring-2 sm:h-[100px] ${
                  selected
                    ? 'ring-[#f37021] shadow-lg shadow-[#f37021]/25'
                    : 'ring-transparent hover:ring-[#f37021]/40'
                }`}
                style={{ backgroundColor: '#f37021' }}
              >
                {tile.imageUrl ? (
                  <img
                    src={tile.imageUrl}
                    alt=""
                    className="h-full w-full object-contain p-2"
                    loading="lazy"
                  />
                ) : (
                  <span className="material-symbols-outlined text-4xl text-white/90">
                    category
                  </span>
                )}
              </div>
              <span
                className={`text-center text-[10px] font-black uppercase leading-tight tracking-wide sm:text-xs ${
                  selected ? 'text-[#f37021]' : 'text-muted'
                }`}
              >
                {tile.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
