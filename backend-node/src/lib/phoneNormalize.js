/**
 * Normalize phone numbers to E.164 (Egypt mobile + landline).
 */
const LANDLINE_AREA_CODES = [
  '40', '45', '46', '47', '48', '50', '55', '57',
  '62', '64', '65', '68', '69', '82', '84', '86', '88', '92', '93', '95', '97',
];

function extractEgyptNationalDigits(input) {
  if (!input || typeof input !== 'string' || !input.trim()) return null;
  let digits = input.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('20')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits || null;
}

function isValidEgyptianPhoneNational(digits) {
  if (/^1[0125]\d{8}$/.test(digits)) return true;
  if (/^2\d{8}$/.test(digits)) return true;
  if (/^3\d{7}$/.test(digits)) return true;
  return LANDLINE_AREA_CODES.some((code) => new RegExp(`^${code}\\d{7}$`).test(digits));
}

function normalizePhoneE164(input) {
  const digits = extractEgyptNationalDigits(input);
  if (!digits || !isValidEgyptianPhoneNational(digits)) return null;
  return `+20${digits}`;
}

module.exports = { normalizePhoneE164, extractEgyptNationalDigits, isValidEgyptianPhoneNational };
