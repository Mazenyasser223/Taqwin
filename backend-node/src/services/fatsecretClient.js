/**
 * FatSecret Platform API — OAuth 2.0 client credentials + REST calls.
 * @see https://platform.fatsecret.com/docs/guides/authentication/oauth2
 */
const fdcCache = require('../lib/fdcCache');

const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const API_URL = 'https://platform.fatsecret.com/rest/server.api';

const TOKEN_CACHE_KEY = 'fatsecret:access_token';
const TOKEN_SKEW_MS = 60_000;

function getCredentials() {
  const clientId = process.env.FATSECRET_CLIENT_ID;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('FATSECRET_CLIENT_ID / FATSECRET_CLIENT_SECRET is not configured');
  }
  return { clientId, clientSecret };
}

function isConfigured() {
  return Boolean(process.env.FATSECRET_CLIENT_ID && process.env.FATSECRET_CLIENT_SECRET);
}

async function requestAccessToken() {
  const { clientId, clientSecret } = getCredentials();
  const scope = process.env.FATSECRET_SCOPE || 'basic';
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`FatSecret OAuth ${res.status}: ${data.error || JSON.stringify(data)}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function getAccessToken() {
  return fdcCache.getOrFetch(
    TOKEN_CACHE_KEY,
    async () => {
      const data = await requestAccessToken();
      return data.access_token;
    },
    Math.max(60_000, 86_400 * 1000 - TOKEN_SKEW_MS)
  );
}

/** FatSecret may return a single object or an array for list nodes. */
function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

async function apiCall(method, params = {}) {
  const token = await getAccessToken();
  const body = new URLSearchParams({
    method,
    format: 'json',
    ...params,
  });
  if (process.env.FATSECRET_REGION) body.set('region', process.env.FATSECRET_REGION);
  if (process.env.FATSECRET_LANGUAGE) body.set('language', process.env.FATSECRET_LANGUAGE);

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const err = new Error(`FatSecret API ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  if (data.error) {
    const code = Number(data.error.code);
    const err = new Error(`FatSecret API ${code}: ${data.error.message || 'Unknown error'}`);
    err.status = code === 21 ? 403 : res.status || 502;
    err.fatsecretCode = code;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`FatSecret API ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

module.exports = {
  isConfigured,
  apiCall,
  asArray,
  getCredentials,
};
