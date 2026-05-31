import { describe, it, expect } from 'vitest';
import { buildProductDescriptionSections, parseProductDescription } from './shopDescription';
import type { Product } from '../types';

const MESSAGES = {
  fallbackDescription: '{name} from {brand}. Category: {category}.',
  highlightInStock: 'In stock',
  highlightOutOfStock: 'Out of stock',
  highlightBrand: 'Brand: {brand}',
  highlightCategory: 'Category: {category}',
  highlightPrice: 'Price: {price}',
  howToReview: 'Review label',
  howToUseAsDirected: 'Use as directed',
  howToStore: 'Store cool and dry',
};

const baseProduct: Product = {
  id: '1',
  name: 'Test Whey Protein',
  brand: 'MuscleTech',
  price: 3800,
  currency: 'EGP',
  stock: 10,
  isActive: true,
  category: { id: 'c1', slug: 'supplements', nameEn: 'Supplements', nameAr: null, icon: null, parentId: null },
};

const SAMPLE = `
<p>Build 70% More Lean Muscle Than Regular Whey!</p>
<h3><b>Key Highlights:</b></h3>
<ul><li><p><b>30g Protein</b></p></li></ul>
<h3><b>How to Use:</b></h3>
<ul><li><p><b>Mix:</b> One scoop.</p></li></ul>
`;

describe('parseProductDescription', () => {
  it('splits description, key highlights, and how to use', () => {
    const sections = parseProductDescription(SAMPLE);
    expect(sections.map((s) => s.id)).toEqual(['description', 'keyHighlights', 'howToUse']);
  });
});

describe('buildProductDescriptionSections', () => {
  it('always returns three sections when description is empty', () => {
    const sections = buildProductDescriptionSections(
      { ...baseProduct, description: null },
      'en',
      MESSAGES
    );
    expect(sections).toHaveLength(3);
    expect(sections.map((s) => s.id)).toEqual(['description', 'keyHighlights', 'howToUse']);
    expect(sections[0].isFallback).toBe(true);
    expect(sections[1].isFallback).toBe(true);
    expect(sections[2].isFallback).toBe(true);
    expect(sections[1].html).toContain('MuscleTech');
    expect(sections[2].html).toContain('Review label');
  });

  it('keeps scraped sections and fills only missing blocks', () => {
    const sections = buildProductDescriptionSections(
      { ...baseProduct, description: '<p>Only intro text from catalog.</p>' },
      'en',
      MESSAGES
    );
    expect(sections[0].html).toContain('Only intro');
    expect(sections[0].isFallback).toBe(false);
    expect(sections[1].isFallback).toBe(true);
    expect(sections[2].isFallback).toBe(true);
  });

  it('uses real content when all MFB sections exist', () => {
    const sections = buildProductDescriptionSections(
      { ...baseProduct, description: SAMPLE },
      'en',
      MESSAGES
    );
    expect(sections.every((s) => !s.isFallback)).toBe(true);
    expect(sections[1].html).toMatch(/Key Highlights|30g Protein/i);
  });
});
