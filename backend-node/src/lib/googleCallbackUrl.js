/**
 * Google OAuth redirect URI — must match an Authorized redirect URI in Google Cloud Console.
 * In production on Render, prefer RENDER_EXTERNAL_URL so a stale localhost .env cannot break prod.
 */
function firstEnvLine(name) {
  const raw = process.env[name];
  if (!raw || typeof raw !== 'string') return '';
  const line = raw.split(/\r?\n/)[0].trim();
  if (line && raw.includes('\n')) {
    console.warn(
      `[auth] ${name} contains multiple lines — using only the first line. Put each variable on its own Render env row.`,
    );
  }
  return line;
}

function resolveGoogleCallbackUrl() {
  const explicit = firstEnvLine('GOOGLE_CALLBACK_URL');
  const isProd = process.env.NODE_ENV === 'production';
  const renderBase = firstEnvLine('RENDER_EXTERNAL_URL').replace(/\/$/, '');
  const apiPublic = firstEnvLine('API_PUBLIC_URL').replace(/\/$/, '');

  if (isProd) {
    if (renderBase) return `${renderBase}/api/auth/google/callback`;
    if (apiPublic) return `${apiPublic}/api/auth/google/callback`;
    if (explicit && !/localhost|127\.0\.0\.1/i.test(explicit)) {
      try {
        const url = new URL(explicit);
        return url.toString().replace(/\/$/, '');
      } catch {
        console.warn('[auth] GOOGLE_CALLBACK_URL is not a valid URL — falling back to localhost default');
      }
    }
    if (explicit) {
      console.warn(
        '[auth] GOOGLE_CALLBACK_URL points to localhost in production — ignored. Set RENDER_EXTERNAL_URL or use a public callback URL.',
      );
    }
  }

  if (explicit) {
    try {
      return new URL(explicit).toString().replace(/\/$/, '');
    } catch {
      /* fall through */
    }
  }
  return 'http://localhost:4000/api/auth/google/callback';
}

module.exports = { resolveGoogleCallbackUrl, firstEnvLine };
