#!/usr/bin/env node
/**
 * Uptime probe — exit 0 when API is healthy, 1 otherwise.
 * Use in host crontab or Better Stack / UptimeRobot webhook runner.
 *
 *   node scripts/uptime-ping.js
 *   node scripts/uptime-ping.js --url https://api.taqwin.com/health
 *   node scripts/uptime-ping.js --live-only   # only checks /health/live
 */
require('dotenv').config({ override: true });

const { initSentry, captureMessage } = require('../src/lib/sentry');

const args = process.argv.slice(2);
const liveOnly = args.includes('--live-only');
const urlArgIdx = args.findIndex((a) => a === '--url');
const baseUrl = (
  urlArgIdx >= 0 ? args[urlArgIdx + 1] : process.env.BACKEND_PUBLIC_URL || 'http://127.0.0.1:4000'
).replace(/\/$/, '');

const path = liveOnly ? '/health/live' : '/health';
const target = `${baseUrl}${path}`;
const timeoutMs = Number(process.env.UPTIME_PING_TIMEOUT_MS || 15000);

async function main() {
  initSentry();
  const started = Date.now();
  const res = await fetch(target, { signal: AbortSignal.timeout(timeoutMs) });
  const body = await res.json().catch(() => ({}));
  const latencyMs = Date.now() - started;

  const ok = res.status === 200 && (body.status === 'ok' || liveOnly);
  if (ok) {
    console.log(`OK ${target} → ${res.status} (${latencyMs}ms) status=${body.status}`);
    process.exit(0);
  }

  const msg = `Uptime check failed: ${target} → HTTP ${res.status} status=${body.status}`;
  console.error(msg);
  captureMessage(msg, 'error', { target, httpStatus: res.status, body, latencyMs });
  process.exit(1);
}

main().catch((err) => {
  console.error(`Uptime ping error: ${err.message}`);
  initSentry();
  captureMessage(`Uptime ping unreachable: ${target}`, 'error', { error: err.message });
  process.exit(1);
});
