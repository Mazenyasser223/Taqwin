/** Extract a product barcode (GTIN) from raw scanner text or GS1/QR payloads. */
export function normalizeBarcodeInput(raw: string): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;

  const gs1 = s.match(/(?:^|\/)01[/]?(\d{14})(?:\D|$)/) || s.match(/01(\d{14})/);
  if (gs1) {
    const gtin = gs1[1];
    if (gtin.length === 14) return gtin.startsWith('0') ? gtin.slice(1, 14) : gtin.slice(0, 13);
    return gtin.slice(0, 13);
  }

  const digits = s.replace(/\D/g, '');
  if (digits.length >= 8 && digits.length <= 14) {
    if (digits.length === 14) return digits.slice(0, 13);
    if (digits.length === 12 || digits.length === 13) return digits;
    return digits.padStart(13, '0');
  }

  return null;
}
