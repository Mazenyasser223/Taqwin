import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { normalizeBarcodeInput } = requireFromHere('../src/lib/barcodeLookup');

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

});
