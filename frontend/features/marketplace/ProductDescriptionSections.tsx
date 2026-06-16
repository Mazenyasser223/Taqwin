import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import type { DescriptionSection } from '../../lib/shopDescription';

interface ProductDescriptionSectionsProps {
  sections: DescriptionSection[];
  sectionTitle: (id: DescriptionSection['id']) => string;
}

/** MFB-style Description / Key Highlights / How to Use — always visible. */
export const ProductDescriptionSections: React.FC<ProductDescriptionSectionsProps> = ({
  sections,
  sectionTitle,
}) => {
  const { t } = useI18n();

  if (!sections.length) {
    return (
      <section
        id="product-description"
        className="shop-product-section-card rounded-2xl border border-primary/25 px-5 py-8 text-center shadow-[0_8px_32px_-8px_rgba(21,139,141,0.2)]"
      >
        <p className="text-sm text-muted">{t('shop.productNoDescription')}</p>
      </section>
    );
  }

  return (
    <div id="product-description" className="space-y-5">
      {sections.map((section) => (
        <section
          key={section.id}
          className="shop-product-section-card overflow-hidden rounded-2xl border border-primary/25 shadow-[0_8px_32px_-8px_rgba(21,139,141,0.2)]"
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-subtle/50 px-5 py-4">
            <h2 className="text-xl font-black text-foreground">{sectionTitle(section.id)}</h2>
            {section.isFallback ? (
              <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                {t('shop.standardInfo')}
              </span>
            ) : null}
          </div>
          <div
            className="shop-product-prose px-5 py-4 text-sm leading-relaxed text-muted [&_h1]:text-xl [&_h1]:font-black [&_h1]:text-foreground [&_h2]:text-lg [&_h2]:font-black [&_h2]:text-foreground [&_h3]:font-bold [&_h3]:text-foreground [&_li]:mb-2 [&_p]:mb-3 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:ps-5"
            dangerouslySetInnerHTML={{ __html: section.html }}
          />
        </section>
      ))}
    </div>
  );
};
