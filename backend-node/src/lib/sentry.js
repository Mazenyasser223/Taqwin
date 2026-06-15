/**
 * Optional Sentry initialization — no-op when SENTRY_DSN is unset.
 */
const { logger } = require('../lib/logger');

let sentryReady = false;

function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;
  try {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    });
    sentryReady = true;
    logger.info('Sentry initialized');
    return Sentry;
  } catch (err) {
    logger.warn({ err: err.message }, 'Sentry init failed — install @sentry/node to enable');
    return null;
  }
}

function withScope(fn) {
  if (!sentryReady) return;
  try {
    const Sentry = require('@sentry/node');
    Sentry.withScope(fn);
  } catch {
    /* ignore */
  }
}

function captureException(err, context = {}) {
  withScope((scope) => {
    Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
    const Sentry = require('@sentry/node');
    Sentry.captureException(err);
  });
}

function captureMessage(message, level = 'warning', context = {}) {
  withScope((scope) => {
    Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
    scope.setLevel(level);
    const Sentry = require('@sentry/node');
    Sentry.captureMessage(message);
  });
}

/** Internal cron route or scheduler job failure */
function captureCronFailure(jobName, err, context = {}) {
  const error = err instanceof Error ? err : new Error(String(err?.message || err));
  captureException(error, { jobName, source: 'cron', ...context });
  captureMessage(`Cron job failed: ${jobName}`, 'error', { jobName, ...context });
}

/** Paymob or checkout payment marked failed */
function capturePaymentFailure(orderId, paymentReference, source = 'paymob') {
  captureMessage('Shop payment failed', 'warning', {
    orderId,
    paymentReference,
    source,
  });
}

module.exports = {
  initSentry,
  captureException,
  captureMessage,
  captureCronFailure,
  capturePaymentFailure,
};
