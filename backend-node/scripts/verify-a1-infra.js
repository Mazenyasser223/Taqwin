/* eslint-disable no-console */
/**
 * Block A1 verification — infra health (Postgres + Redis + Mongo).
 *
 *   node scripts/verify-a1-infra.js
 *   node scripts/verify-a1-infra.js --url http://localhost:4000/health
 */
require('dotenv').config();
const { getInfraHealth } = require('../src/lib/infraHealth');

async function main() {
  const urlArg = process.argv.find((a) => a.startsWith('--url='));
  const healthUrl = urlArg ? urlArg.slice(6) : process.argv.includes('--url')
    ? process.argv[process.argv.indexOf('--url') + 1]
    : null;

  console.log('Block A1 — infra verification\n');

  if (healthUrl) {
    const res = await fetch(healthUrl);
    const body = await res.json();
    console.log('GET', healthUrl, '→', res.status);
    console.log(JSON.stringify(body, null, 2));
    if (!body.stores) {
      console.error('\nMissing stores in /health — is the server running latest code?');
      process.exit(1);
    }
    const ok = body.status === 'ok' || body.status === 'degraded';
    console.log(ok ? '\nA1 /health check passed.' : '\nA1 /health check FAILED.');
    process.exit(ok ? 0 : 1);
  }

  const infra = await getInfraHealth();
  console.log('Postgres:', infra.postgres.status);
  console.log('Redis:   ', infra.redis.status, infra.redis.configured === false ? '(not configured — OK in dev)' : '');
  console.log('Mongo:   ', infra.mongo.status, infra.mongo.configured === false ? '(not configured)' : '');

  if (infra.mongo.host) console.log('  host:', infra.mongo.host, 'db:', infra.mongo.db);

  if (infra.postgres.status !== 'connected') {
    console.error('\nPostgres must be connected.');
    process.exit(1);
  }

  console.log('\nBlock A1 infra verification passed.');
  console.log('Tip: start server and run: node scripts/verify-a1-infra.js --url http://localhost:4000/health');
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
