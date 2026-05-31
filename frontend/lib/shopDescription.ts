import type { Product } from '../types';
import { formatShopPrice } from './shopFormat';

/** Decode common HTML entities from WooCommerce imports. */
export function decodeShopHtml(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&nbsp;/g, ' ');
}

/** Remove MFB site footer / chrome accidentally stored in product HTML. */
export function stripProductPageChrome(html: string): string {
  if (!html.trim()) return html;

  let out = html.replace(/<(?:link|style)\b[^>]*>/gi, '');
  out = out.replace(/<(?:footer|nav|aside)\b[\s\S]*?<\/(?:footer|nav|aside)>/gi, '');

  const cutAt = (index: number) => (index >= 0 ? out.slice(0, index) : out);

  const mainFooter = out.match(/<\/main>\s*<\/div>\s*<footer\b/i);
  if (mainFooter && mainFooter.index != null && mainFooter.index >= out.length * 0.25) {
    out = cutAt(mainFooter.index);
  }

  for (const marker of [
    /<footer\b/i,
    /\bwd-footer\b/i,
    /\belementor-129543\b/i,
    /Selling premium Fitness\s*&\s*Health products/i,
    /USEFUL LINKS/i,
    /Top Categories[\s\S]{0,200}Healthy Crocieries/i,
  ]) {
    const idx = out.search(marker);
    if (idx >= 0 && idx > out.length * 0.25) out = cutAt(idx);
  }

  return out.trim();
}

/** Strip scripts and inline handlers before rendering product HTML. */
export function sanitizeShopHtml(html: string): string {
  return stripProductPageChrome(html)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

export interface DescriptionSection {
  id: 'description' | 'keyHighlights' | 'howToUse';
  title: string;
  html: string;
  /** True when content was generated because the catalog had no section. */
  isFallback?: boolean;
}

export interface DescriptionMessages {
  fallbackDescription: string;
  highlightInStock: string;
  highlightOutOfStock: string;
  highlightBrand: string;
  highlightCategory: string;
  highlightPrice: string;
  howToReview: string;
  howToUseAsDirected: string;
  howToStore: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function findSectionStart(html: string, keywordIndex: number): number {
  if (keywordIndex <= 0) return 0;
  const before = html.slice(0, keywordIndex);
  const candidates = [
    before.lastIndexOf('<h1'),
    before.lastIndexOf('<h2'),
    before.lastIndexOf('<h3'),
    before.lastIndexOf('<h4'),
    before.lastIndexOf('<p'),
    before.lastIndexOf('<div'),
  ].filter((i) => i >= 0);
  return candidates.length ? Math.max(...candidates) : keywordIndex;
}

function findKeywordIndex(html: string, keyword: RegExp): number {
  const m = html.match(keyword);
  if (!m || m.index == null) return -1;
  return m.index;
}

/** Split MFB-style description into Description / Key Highlights / How to Use. */
export function parseProductDescription(raw: string | null | undefined): DescriptionSection[] {
  if (!raw?.trim()) return [];

  const decoded = decodeShopHtml(raw.trim());
  const hasHtml = /<[a-z][\s\S]*>/i.test(decoded);
  const html = hasHtml ? decoded : decoded.replace(/\n/g, '<br/>');

  const khIdx = findKeywordIndex(html, /key\s*highlights/i);
  const htuIdx = findKeywordIndex(html, /how\s+to\s+use/i);

  const sections: DescriptionSection[] = [];

  if (khIdx >= 0 && htuIdx > khIdx) {
    const khStart = findSectionStart(html, khIdx);
    const htuStart = findSectionStart(html, htuIdx);
    const intro = html.slice(0, khStart).trim();
    const highlights = html.slice(khStart, htuStart).trim();
    const howTo = html.slice(htuStart).trim();

    if (intro) {
      sections.push({ id: 'description', title: 'description', html: sanitizeShopHtml(intro) });
    }
    if (highlights) {
      sections.push({ id: 'keyHighlights', title: 'keyHighlights', html: sanitizeShopHtml(highlights) });
    }
    if (howTo) {
      sections.push({ id: 'howToUse', title: 'howToUse', html: sanitizeShopHtml(howTo) });
    }
    return sections;
  }

  if (khIdx >= 0) {
    const khStart = findSectionStart(html, khIdx);
    const intro = html.slice(0, khStart).trim();
    const highlights = html.slice(khStart).trim();
    if (intro) {
      sections.push({ id: 'description', title: 'description', html: sanitizeShopHtml(intro) });
    }
    if (highlights) {
      sections.push({ id: 'keyHighlights', title: 'keyHighlights', html: sanitizeShopHtml(highlights) });
    }
    return sections;
  }

  if (htuIdx >= 0) {
    const htuStart = findSectionStart(html, htuIdx);
    const intro = html.slice(0, htuStart).trim();
    const howTo = html.slice(htuStart).trim();
    if (intro) {
      sections.push({ id: 'description', title: 'description', html: sanitizeShopHtml(intro) });
    }
    if (howTo) {
      sections.push({ id: 'howToUse', title: 'howToUse', html: sanitizeShopHtml(howTo) });
    }
    return sections;
  }

  sections.push({ id: 'description', title: 'description', html: sanitizeShopHtml(html) });
  return sections;
}

function buildFallbackHighlightsHtml(messages: DescriptionMessages, inStock: boolean): string {
  const items = [
    messages.highlightBrand,
    messages.highlightCategory,
    messages.highlightPrice,
    inStock ? messages.highlightInStock : messages.highlightOutOfStock,
  ];
  return `<ul>${items.map((line) => `<li><p>${escapeHtml(line)}</p></li>`).join('')}</ul>`;
}

function buildFallbackHowToHtml(messages: DescriptionMessages): string {
  const items = [messages.howToReview, messages.howToUseAsDirected, messages.howToStore];
  return `<ul>${items.map((line) => `<li><p>${escapeHtml(line)}</p></li>`).join('')}</ul>`;
}

function productDisplayName(product: Product, language: string): string {
  return language === 'ar' && product.nameAr ? product.nameAr : product.name;
}

function categoryDisplayName(
  product: Product,
  language: string,
  categoryLabel?: (cat: { nameEn: string; nameAr?: string | null }) => string
): string {
  if (!product.category) return '';
  return categoryLabel ? categoryLabel(product.category) : product.category.nameEn;
}

/**
 * Always returns Description, Key Highlights, and How to Use (Option A).
 * Missing sections get sensible defaults from product data.
 */
export function buildProductDescriptionSections(
  product: Product,
  language: string,
  messages: DescriptionMessages,
  categoryLabel?: (cat: { nameEn: string; nameAr?: string | null }) => string
): DescriptionSection[] {
  const raw =
    language === 'ar' && product.descriptionAr ? product.descriptionAr : product.description;
  const parsed = parseProductDescription(raw);
  const byId = new Map(parsed.map((s) => [s.id, s]));

  const name = decodeShopHtml(productDisplayName(product, language));
  const brand = decodeShopHtml(product.brand);
  const category = decodeShopHtml(categoryDisplayName(product, language, categoryLabel));

  const priceLine = formatShopPrice(product.price, product.currency ?? 'EGP', language);
  const inStock = product.stock > 0;

  const msgs: DescriptionMessages = {
    ...messages,
    highlightBrand: messages.highlightBrand.replace(/\{brand\}/g, brand),
    highlightCategory: messages.highlightCategory.replace(/\{category\}/g, category || '—'),
    highlightPrice: messages.highlightPrice.replace(/\{price\}/g, priceLine),
    fallbackDescription: messages.fallbackDescription
      .replace(/\{name\}/g, name)
      .replace(/\{brand\}/g, brand)
      .replace(/\{category\}/g, category || '—'),
  };

  let description = byId.get('description');
  const descriptionHtml = description?.html?.trim();
  if (!descriptionHtml) {
    const fromRaw = raw?.trim()
      ? sanitizeShopHtml(
          /<[a-z][\s\S]*>/i.test(raw) ? raw : decodeShopHtml(raw).replace(/\n/g, '<br/>')
        )
      : '';
    description = {
      id: 'description',
      title: 'description',
      html: fromRaw || `<p>${escapeHtml(msgs.fallbackDescription)}</p>`,
      isFallback: !fromRaw,
    };
  } else {
    description = { ...description, html: descriptionHtml };
  }

  let keyHighlights = byId.get('keyHighlights');
  if (!keyHighlights?.html?.trim()) {
    keyHighlights = {
      id: 'keyHighlights',
      title: 'keyHighlights',
      html: buildFallbackHighlightsHtml(msgs, inStock),
      isFallback: true,
    };
  }

  let howToUse = byId.get('howToUse');
  if (!howToUse?.html?.trim()) {
    howToUse = {
      id: 'howToUse',
      title: 'howToUse',
      html: buildFallbackHowToHtml(msgs),
      isFallback: true,
    };
  }

  return [description, keyHighlights, howToUse];
}

export function plainTextFromHtml(html: string): string {
  return decodeShopHtml(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}
