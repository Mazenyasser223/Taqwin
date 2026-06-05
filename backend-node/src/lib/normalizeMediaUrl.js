/**
 * Rewrite dev/ephemeral upload URLs to the public API base so clients can load media in production.
 */
function resolveApiPublicBase() {
  const fromEnv = process.env.API_PUBLIC_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const render = process.env.RENDER_EXTERNAL_URL?.trim();
  if (render) return render.replace(/\/$/, '');
  return 'https://taqwin.onrender.com';
}

const LOCAL_DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i;

function normalizeMediaUrl(url) {
  if (!url || typeof url !== 'string') return url;
  let out = url.trim();
  const base = resolveApiPublicBase();

  if (out.startsWith('/uploads/')) {
    out = `${base}${out}`;
  }

  if (LOCAL_DEV_ORIGIN.test(out)) {
    out = out.replace(LOCAL_DEV_ORIGIN, base);
  }

  if (out.startsWith('http://taqwin.onrender.com')) {
    out = out.replace('http://', 'https://');
  }

  return out;
}

module.exports = { normalizeMediaUrl, resolveApiPublicBase };
