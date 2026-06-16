#!/usr/bin/env node
/** Point DIRECT_URL at db.PROJECT_REF.supabase.co (not the pooler). */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ref = (process.env.DATABASE_URL || '').match(/postgres\.([^:@]+)/)?.[1];
if (!ref) {
  console.error('Could not parse project ref from DATABASE_URL');
  process.exit(1);
}

const poolUrl = new URL(process.env.DATABASE_URL.replace(/^postgresql:\/\//, 'postgres://'));
const direct = process.env.DIRECT_URL
  ? new URL(process.env.DIRECT_URL.replace(/^postgresql:\/\//, 'postgres://'))
  : poolUrl;
const password = decodeURIComponent(direct.password || poolUrl.password || '');
const user = direct.username || poolUrl.username || `postgres.${ref}`;
const poolHost = poolUrl.hostname;
const mode = process.argv.includes('--session-pooler') ? 'session-pooler' : 'direct';
const host = mode === 'session-pooler' ? poolHost : `db.${ref}.supabase.co`;
const port = mode === 'session-pooler' ? '5432' : '5432';
const fixed = `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/postgres?sslmode=require`;

const envPath = path.join(__dirname, '..', '.env');
let text = fs.readFileSync(envPath, 'utf8');
if (/^DIRECT_URL=.*$/m.test(text)) {
  text = text.replace(/^DIRECT_URL=.*$/m, `DIRECT_URL="${fixed}"`);
} else {
  text += `\nDIRECT_URL="${fixed}"\n`;
}
fs.writeFileSync(envPath, text);
console.log(`DIRECT_URL -> ${host}:${port} (${mode})`);
