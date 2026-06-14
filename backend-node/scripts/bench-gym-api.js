/**
 * Quick API latency benchmark (3 runs per route).
 * Usage: node scripts/bench-gym-api.js
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');

const BASE = `http://127.0.0.1:${process.env.PORT || 4002}`;
const EMAIL = process.argv[2] || 't2t0test@gmail.com';

async function timeFetch(path, token) {
  const start = performance.now();
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  await res.text();
  return { ms: performance.now() - start, status: res.status };
}

async function bench(label, path, token, runs = 3) {
  const samples = [];
  for (let i = 0; i < runs; i++) samples.push((await timeFetch(path, token)).ms);
  const avg = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
  console.log(`${label.padEnd(42)} ${avg} ms  (${samples.map((n) => Math.round(n)).join(', ')})`);
  return avg;
}

async function main() {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: 'Taqwin#2025', rememberMe: true }),
  });
  const loginBody = await loginRes.json();
  if (!loginBody.token) {
    console.error('Login failed', loginBody);
    process.exit(1);
  }
  const token = loginBody.token;
  console.log('Benchmarking as', EMAIL, '\n');
  await bench('GET /health (cached)', '/health');
  await bench('GET /api/dashboard/gym?checkInsRange=6m', '/api/dashboard/gym?checkInsRange=6m', token);
  await bench('GET /api/dashboard/gym/check-ins?1m', '/api/dashboard/gym/check-ins?checkInsRange=1m', token);
  await bench('GET /api/dashboard/gym/check-ins?1y', '/api/dashboard/gym/check-ins?checkInsRange=1y', token);
  await bench('GET /api/profile', '/api/profile', token);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
