#!/usr/bin/env node
/**
 * Resolve Supabase direct DB URL (db.PROJECT_REF.supabase.co:5432) from pooler URLs.
 * Migrations must NOT use the session pooler — it hits max connection limits.
 */
function inferSupabaseDirectUrl(rawUrl) {
  if (!rawUrl) return null;
  try {
    const u = new URL(rawUrl);
    const ref = u.username.includes('.') ? u.username.split('.').slice(1).join('.') : null;
    if (!ref) return null;
    if (u.hostname === `db.${ref}.supabase.co`) {
      u.searchParams.delete('pgbouncer');
      u.searchParams.delete('connection_limit');
      return u.toString();
    }
    if (!u.hostname.includes('pooler.supabase.com')) return null;
    u.hostname = `db.${ref}.supabase.co`;
    u.port = '5432';
    u.searchParams.delete('pgbouncer');
    u.searchParams.delete('connection_limit');
    return u.toString();
  } catch {
    return null;
  }
}

module.exports = { inferSupabaseDirectUrl };
