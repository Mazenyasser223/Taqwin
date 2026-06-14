const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeBarcodeInput } = require('../src/lib/barcodeLookup');
const { shouldUseCatalogMatch } = require('../src/lib/mealCaptureMatch');

describe('barcodeLookup', () => {
  it('normalizeBarcodeInput extracts GTIN from GS1 digital link', () => {
    assert.equal(normalizeBarcodeInput('https://id.gs1.org/01/06224001234567'), '6224001234567');
  });

  it('normalizeBarcodeInput accepts plain EAN-13', () => {
    assert.equal(normalizeBarcodeInput('6224001234567'), '6224001234567');
  });

  it('normalizeBarcodeInput pads short numeric codes', () => {
    const code = normalizeBarcodeInput('40170725');
    assert.ok(code && code.length === 13);
  });

  it('normalizeBarcodeInput rejects garbage', () => {
    assert.equal(normalizeBarcodeInput('hello'), null);
    assert.equal(normalizeBarcodeInput(''), null);
  });

  it('shouldUseCatalogMatch gates WebTeb linking for barcode products', () => {
    const item = {
      confidence_score: 0.88,
      confidence: { identification: 'high', portion_estimation: 'high', nutrition_estimation: 'high' },
    };
    assert.equal(shouldUseCatalogMatch(item, 0.9), true);
    assert.equal(shouldUseCatalogMatch(item, 0.5), false);
  });
});
