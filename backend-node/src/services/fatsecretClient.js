/**
 * Compatibility shim for FatSecret client.
 * If credentials are not configured, routes should fail gracefully.
 */

const CLIENT_ID = process.env.FATSECRET_CLIENT_ID;
const CLIENT_SECRET = process.env.FATSECRET_CLIENT_SECRET;

function isConfigured() {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

async function apiCall() {
  throw new Error('FatSecret API integration files are incomplete in this build');
}

module.exports = { apiCall, asArray, isConfigured };
