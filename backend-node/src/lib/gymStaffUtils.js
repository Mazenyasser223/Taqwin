/**
 * Gym staff helpers — email normalization and validation.
 */

function normalizeStaffEmail(raw) {
  if (raw === null || raw === undefined) return null;
  const email = String(raw).trim().toLowerCase();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error('Invalid email address');
    err.status = 400;
    throw err;
  }
  return email;
}

function staffInitials(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const ROLE_ICONS = {
  trainer: 'fitness_center',
  receptionist: 'support_agent',
  cleaner: 'cleaning_services',
  other: 'badge',
};

module.exports = { normalizeStaffEmail, staffInitials, ROLE_ICONS };
