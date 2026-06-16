import React, { useMemo, useState } from 'react';

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1593094859027-e9623c44810a?q=80&w=800';

interface ProductGalleryProps {
  images: string[];
  alt: string;
  saleDiscount?: number | null;
}

export const ProductGallery: React.FC<ProductGalleryProps> = ({
  images,
  alt,
  saleDiscount,
}) => {
  const gallery = useMemo(
    () => images.filter(Boolean).length ? images.filter(Boolean) : [FALLBACK_IMG],
    [images]
  );
  const [active, setActive] = useState(0);
  const main = gallery[Math.min(active, gallery.length - 1)] ?? FALLBACK_IMG;
  const showThumbs = gallery.length > 1;

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-subtle bg-elevated/50 aspect-square max-h-[min(70vh,520px)]">
        {saleDiscount ? (
          <span className="absolute top-4 start-4 z-10 rounded-lg bg-[#f37021] px-3 py-1 text-xs font-black uppercase text-white shadow-lg">
            -{saleDiscount}%
          </span>
        ) : null}
        <img src={main} alt={alt} className="h-full w-full object-contain p-6" />
      </div>
      {showThumbs ? (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {gallery.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-elevated/50 p-1 transition ${
                i === active ? 'border-primary' : 'border-subtle hover:border-primary/40'
              }`}
              aria-label={`Image ${i + 1}`}
            >
              <img src={url} alt="" className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
