/**
 * Google OAuth redirect URI — must match an Authorized redirect URI in Google Cloud Console.
 * In production on Render, prefer RENDER_EXTERNAL_URL so a stale localhost .env cannot break prod.
 */
function resolveGoogleCallbackUrl() {
  const explicit = process.env.GOOGLE_CALLBACK_URL?.trim();
  const isProd = process.env.NODE_ENV === 'production';
  const renderBase = process.env.RENDER_EXTERNAL_URL?.trim().replace(/\/$/, '');
  const apiPublic = process.env.API_PUBLIC_URL?.trim().replace(/\/$/, '');

  if (isProd) {
    if (renderBase) return `${renderBase}/api/auth/google/callback`;
    if (apiPublic) return `${apiPublic}/api/auth/google/callback`;
    if (explicit && !/localhost|127\.0\.0\.1/i.test(explicit)) return explicit;
    if (explicit) {
      console.warn(
        '[auth] GOOGLE_CALLBACK_URL points to localhost in production — ignored. Set RENDER_EXTERNAL_URL or use a public callback URL.',
      );
    }
  }

  if (explicit) return explicit;
  return 'http://localhost:4000/api/auth/google/callback';
}

module.exports = { resolveGoogleCallbackUrl };
