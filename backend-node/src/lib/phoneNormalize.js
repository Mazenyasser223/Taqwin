/**
 * Normalize phone numbers to E.164 (Egypt-focused defaults).
 */
function normalizePhoneE164(input) {
  if (!input || typeof input !== 'string') return null;
  let digits = input.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('20')) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (digits.length !== 10 || !digits.startsWith('1')) {
    return null;
  }

  return `+20${digits}`;
}

module.exports = { normalizePhoneE164 };
