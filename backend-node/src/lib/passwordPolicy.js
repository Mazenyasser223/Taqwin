/**
 * Shared password rules for register, reset, and change-password.
 */
const RULES = [
  { test: (p) => p.length >= 8, message: 'Password must be at least 8 characters' },
  { test: (p) => /[A-Z]/.test(p), message: 'Password must include an uppercase letter' },
  { test: (p) => /[a-z]/.test(p), message: 'Password must include a lowercase letter' },
  { test: (p) => /\d/.test(p), message: 'Password must include a number' },
  { test: (p) => /[^A-Za-z0-9]/.test(p), message: 'Password must include a special character' },
];

function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }
  for (const rule of RULES) {
    if (!rule.test(password)) {
      return { valid: false, error: rule.message };
    }
  }
  return { valid: true };
}

module.exports = { validatePassword, RULES };
