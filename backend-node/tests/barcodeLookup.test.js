import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { normalizeBarcodeInput } = requireFromHere('../src/lib/barcodeLookup');
const { shouldUseCatalogMatch } = requireFromHere('../src/lib/mealCaptureMatch');

describe('barcodeLookup', () => {
  it('normalizeBarcodeInput extracts GTIN from GS1 digital link', () => {
    expect(normalizeBarcodeInput('https://id.gs1.org/01/06224001234567')).toBe('6224001234567');
  });

  it('normalizeBarcodeInput accepts plain EAN-13', () => {
    expect(normalizeBarcodeInput('6224001234567')).toBe('6224001234567');
  });

  it('normalizeBarcodeInput pads short numeric codes', () => {
    const code = normalizeBarcodeInput('40170725');
    expect(code && code.length).toBe(13);
  });

  it('normalizeBarcodeInput rejects garbage', () => {
    expect(normalizeBarcodeInput('hello')).toBeNull();
    expect(normalizeBarcodeInput('')).toBeNull();
  });

  it('shouldUseCatalogMatch gates WebTeb linking for barcode products', () => {
    const item = {
      confidence_score: 0.88,
      confidence: { identification: 'high', portion_estimation: 'high', nutrition_estimation: 'high' },
    };
    expect(shouldUseCatalogMatch(item, 0.9)).toBe(true);
    expect(shouldUseCatalogMatch(item, 0.5)).toBe(false);
  });
});
