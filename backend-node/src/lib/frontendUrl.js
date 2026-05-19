/**
 * SPA origin for OAuth redirects, password-reset links, and CORS.
 * Must match the URL shown in the Vite terminal (often 3000 or 3001).
 */
function getFrontendUrl() {
  const url = process.env.FRONTEND_URL || 'http://localhost:3001';
  return url.replace(/\/$/, '');
}

module.exports = { getFrontendUrl };
