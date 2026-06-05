/**
 * Resolve Supabase project URL for Storage when SUPABASE_URL is omitted.
 * Parses project ref from Supabase Postgres connection strings.
 */
function resolveSupabaseUrl() {
  const explicit = process.env.SUPABASE_URL?.trim();
  if (explicit) return explicit;

  const db = process.env.DATABASE_URL || '';
  const match = db.match(/postgres\.([a-z0-9]+)/i);
  if (match) {
    return `https://${match[1]}.supabase.co`;
  }
  return null;
}

function resolveSupabaseServiceKey() {
  return process.env.SUPABASE_SERVICE_KEY?.trim() || null;
}

function isSupabaseStorageConfigured() {
  return Boolean(resolveSupabaseUrl() && resolveSupabaseServiceKey());
}

module.exports = {
  resolveSupabaseUrl,
  resolveSupabaseServiceKey,
  isSupabaseStorageConfigured,
};
