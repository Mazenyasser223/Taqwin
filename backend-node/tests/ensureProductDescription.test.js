import { describe, it, expect } from 'vitest';
import {
  ensureProductDescription,
  productHasAllSections,
  parseProductDescription,
} from '../src/lib/ensureProductDescription.js';

const base = {
  name: 'Test Whey',
  brand: 'MuscleTech',
  price: 3800,
  currency: 'EGP',
  stock: 5,
  category: { nameEn: 'Supplements' },
};

describe('parseProductDescription', () => {
  it('splits MFB-style HTML', () => {
    const raw = `<p>Intro</p><h3>Key Highlights:</h3><ul><li>A</li></ul><h3>How to Use:</h3><ul><li>B</li></ul>`;
    const p = parseProductDescription(raw);
    expect(p.description).toContain('Intro');
    expect(p.keyHighlights).toMatch(/Key Highlights/i);
    expect(p.howToUse).toMatch(/How to Use/i);
  });
});

describe('ensureProductDescription', () => {
  it('adds missing sections for empty description', () => {
    const html = ensureProductDescription({ ...base, description: null });
    expect(productHasAllSections(html)).toBe(true);
    expect(html).toMatch(/Key Highlights/i);
    expect(html).toMatch(/How to Use/i);
  });

  it('keeps existing description and fills gaps', () => {
    const html = ensureProductDescription({
      ...base,
      description: '<p>Catalog intro only.</p>',
    });
    expect(html).toContain('Catalog intro only');
    expect(productHasAllSections(html)).toBe(true);
  });
});
