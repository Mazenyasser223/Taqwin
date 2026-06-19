const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

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

/** Service-role client for Storage admin (Node 20 needs explicit WebSocket transport). */
function createSupabaseAdminClient(url, key) {
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { WebSocket },
  });
}

module.exports = {
  resolveSupabaseUrl,
  resolveSupabaseServiceKey,
  isSupabaseStorageConfigured,
  createSupabaseAdminClient,
};
