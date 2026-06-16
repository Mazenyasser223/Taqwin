/**
 * Shared Sentry bootstrap for host crontab scripts (cron-enqueue-*.js).
 */
const { initSentry, captureCronFailure } = require('../../src/lib/sentry');

function initCronSentry() {
  initSentry();
}

function failCronScript(jobName, err) {
  console.error(`[cron:${jobName}] failed:`, err);
  captureCronFailure(jobName, err, { script: true });
  process.exit(1);
}

module.exports = { initCronSentry, failCronScript };
